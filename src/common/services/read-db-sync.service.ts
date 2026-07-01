import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

type TableColumn = {
  column_name: string;
  data_type: string;
  formatted_type: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  datetime_precision: number | null;
  column_default: string | null;
  is_nullable: 'YES' | 'NO';
  is_identity: 'YES' | 'NO';
  identity_generation: string | null;
  identity_start: string | null;
  identity_increment: string | null;
  identity_minimum: string | null;
  identity_maximum: string | null;
  identity_cycle: 'YES' | 'NO' | null;
};

type SequenceInfo = {
  sequence_name: string;
  sequence_schema: string;
  data_type: string;
  start_value: string;
  minimum_value: string;
  maximum_value: string;
  increment: string;
  cache_size: string;
  cycle_option: 'YES' | 'NO';
};

type ForeignKeyInfo = {
  constraint_name: string;
  table_name: string;
  table_schema: string;
  foreign_table_name: string;
  foreign_table_schema: string;
  column_names: string[];
  foreign_column_names: string[];
  constraint_def: string;
};

type SecondaryIndexInfo = {
  index_name: string;
  table_name: string;
  index_def: string;
};

@Injectable()
export class ReadDbSyncService implements OnModuleInit {
  private readonly logger = new Logger(ReadDbSyncService.name);
  private tablesCreated = 0;
  private tablesDropped = 0;
  private sequencesSynced = 0;
  private indexesSynced = 0;
  private foreignKeysSynced = 0;
  private rowsSynced = 0;

  /**
   * Tablas de eventos/logs de alto volumen que se excluyen de la sincronización
   * completa al inicio para evitar ralentizar el arranque del servicio.
   * Estas tablas son append-only y no requieren sincronización bidireccional
   * en cada arranque.
   */
  private readonly EXCLUDED_TABLES = new Set([
    'webhook_events',
    'unmatched_webhooks',
    'user_trace_logs',
    'projection_failures',
  ]);

  constructor(
    @InjectDataSource()
    private readonly writeDataSource: DataSource,
    @InjectDataSource('read')
    private readonly readDataSource: DataSource,
  ) { }

  async onModuleInit() {
    await this.syncDatabases();
  }

  /**
   * Synchronizes the read database schema with the write database
   */
  async syncDatabases(): Promise<void> {
    try {
      this.logger.log(
        `Starting DB sync: write=${this.getDataSourceDatabaseName(this.writeDataSource)} read=${this.getDataSourceDatabaseName(this.readDataSource)}`,
      );

      await this.readDataSource.query(
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
      );

      this.tablesCreated = 0;
      this.tablesDropped = 0;
      this.sequencesSynced = 0;
      this.indexesSynced = 0;
      this.foreignKeysSynced = 0;
      this.rowsSynced = 0;

      const writeTables = await this.getTableNames(this.writeDataSource);

      await this.syncEnums();
      await this.dropObsoleteTables(writeTables);
      await this.syncSequencesStructure();
      await this.syncTablesAndColumns(writeTables);
      await this.syncSequenceOwnerships(writeTables);
      await this.syncSecondaryIndexes(writeTables);

      await this.dropAllForeignKeysFromReadDB();

      // Data must be copied before restoring constraints that can reject rows.
      await this.syncAllData(writeTables);
      await this.syncSequenceValues(writeTables);
      await this.syncFinalNotNullColumns(writeTables);
      await this.syncForeignKeys(writeTables);

      // Log summary only
      if (
        this.tablesCreated > 0 ||
        this.tablesDropped > 0 ||
        this.sequencesSynced > 0 ||
        this.indexesSynced > 0 ||
        this.foreignKeysSynced > 0 ||
        this.rowsSynced > 0
      ) {
        this.logger.log(
          `Database sync completed: ${this.tablesDropped} tables dropped, ${this.tablesCreated} tables created, ${this.sequencesSynced} sequences synced, ${this.rowsSynced} rows synced, ${this.indexesSynced} secondary indexes recreated, ${this.foreignKeysSynced} foreign keys recreated`,
        );
      } else {
        this.logger.log('Database sync completed: already up to date');
      }
    } catch (error) {
      this.logger.error('Error during database synchronization', error);
      throw error;
    }
  }

  /**
   * Gets the CREATE TABLE statement for a given table
   */
  private async getCreateTableStatement(tableName: string): Promise<string> {
    const columns = await this.getTableColumns(this.writeDataSource, tableName);
    const columnDefs = columns.map((column) => this.buildColumnDefinition(column)).join(', ');

    const primaryKey = await this.getPrimaryKeyColumns(
      this.writeDataSource,
      tableName,
    );

    let createStatement = `CREATE TABLE IF NOT EXISTS ${this.quoteIdentifier(tableName)} (${columnDefs}`;

    if (primaryKey.length > 0) {
      const pkColumns = primaryKey.map((pk) => this.quoteIdentifier(pk)).join(', ');
      createStatement += `, PRIMARY KEY (${pkColumns})`;
    }

    createStatement += ')';

    return createStatement;
  }

  /**
   * Syncs all data from write database to read database
   */
  async syncAllData(tables?: Array<{ table_name: string }>): Promise<void> {
    const sourceTables = tables ?? (await this.getTableNames(this.writeDataSource));

    for (const { table_name } of sourceTables) {
      await this.syncTableData(table_name);
    }
  }

  /**
   * Syncs data for a specific table from write to read database.
   * Si detecta un conflicto insalvable, fuerza el estado de Write DB mediante reemplazo total.
   */
  async syncTableData(tableName: string): Promise<void> {
    try {
      const pkColumns = await this.getPrimaryKeyColumns(this.writeDataSource, tableName);
      const data = await this.writeDataSource.query(`SELECT * FROM ${this.quoteIdentifier(tableName)}`);

      // 1. Limpieza inicial de huérfanos
      await this.deleteOrphans(tableName, pkColumns);

      // 2. Si no hay Primary Keys en la tabla, usamos reemplazo total directamente
      if (pkColumns.length === 0) {
        await this.replaceTableData(tableName, data);
        this.rowsSynced += data.length;
        return;
      }

      if (data.length === 0) return;

      const columns = Object.keys(data[0]);
      const identityColumns = await this.getIdentityColumns(this.writeDataSource, tableName);
      const columnNames = columns.map((col) => this.quoteIdentifier(col)).join(', ');
      const pkConflict = pkColumns.map((pk) => this.quoteIdentifier(pk)).join(', ');
      const identityClause = identityColumns.length > 0 ? ' OVERRIDING SYSTEM VALUE' : '';

      const updateSet = columns
        .filter((col) => !pkColumns.includes(col))
        .map((col) => `${this.quoteIdentifier(col)} = EXCLUDED.${this.quoteIdentifier(col)}`)
        .join(', ');

      const upsertQuery = updateSet
        ? `INSERT INTO ${this.quoteIdentifier(tableName)} (${columnNames})${identityClause} VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (${pkConflict}) DO UPDATE SET ${updateSet}`
        : `INSERT INTO ${this.quoteIdentifier(tableName)} (${columnNames})${identityClause} VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (${pkConflict}) DO NOTHING`;

      let syncedCount = 0;

      for (const row of data) {
        const values = columns.map((col) => row[col]);
        
        try {
          await this.readDataSource.query(upsertQuery, values);
          syncedCount++;
        } catch (rowError: any) {
          // 3. ESTRATEGIA "WRITE ES LA MAESTRA ABSOLUTA":
          // Si el UPSERT falla (casi siempre por un constraint UNIQUE secundario desfasado),
          // borramos la tabla entera en Read y la forzamos fresca desde Write usando tu propio método.
          this.logger.warn(`Conflicto de constraint en tabla ${tableName} (PK: ${row[pkColumns[0]]}). Forzando reemplazo total desde Write DB...`);
          
          await this.replaceTableData(tableName, data);
          
          // Ajustamos el contador: restamos lo que habíamos avanzado y sumamos el total de la tabla
          this.rowsSynced = (this.rowsSynced - syncedCount) + data.length;
          
          // Salimos de la función porque replaceTableData ya sincronizó toda la tabla
          return; 
        }
      }
      
      this.rowsSynced += syncedCount;
      
    } catch (error: any) {
      this.logger.error(`Critical error syncing table ${tableName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Syncs a single row to the read database
   * Used by event handlers after insert/update operations
   */
  async syncRow(tableName: string, id: string): Promise<void> {
    try {
      // Get the row from write database
      const data = await this.writeDataSource.query(
        `SELECT * FROM "${tableName}" WHERE id = $1`,
        [id],
      );

      if (data.length === 0) {
        this.logger.warn(`No data found for ${tableName} with id ${id}`);
        return;
      }

      const row = data[0];
      const columns = Object.keys(row);
      const columnNames = columns.map((col) => `"${col}"`).join(', ');
      const values = columns.map((col) => row[col]);
      const placeholders = columns
        .map((_, index) => `$${index + 1}`)
        .join(', ');

      // Upsert into read database
      const updateSet = columns
        .filter((col) => col !== 'id')
        .map((col) => `"${col}" = EXCLUDED."${col}"`)
        .join(', ');

      const upsertQuery = `
        INSERT INTO "${tableName}" (${columnNames}) 
        VALUES (${placeholders})
        ON CONFLICT (id) 
        DO UPDATE SET ${updateSet}
      `;

      await this.readDataSource.query(upsertQuery, values);
      this.logger.debug(`Synced row for ${tableName} with id ${id}`);
    } catch (error) {
      this.logger.error(`Error syncing row for ${tableName}`, error);
      throw error;
    }
  }

  /**
   * Deletes a row from the read database
   * Used by event handlers after delete operations
   */
  async deleteRow(tableName: string, id: string): Promise<void> {
    try {
      await this.readDataSource.query(
        `DELETE FROM ${this.quoteIdentifier(tableName)} WHERE id = $1`,
        [id],
      );
      this.logger.debug(`Deleted row from ${tableName} with id ${id}`);
    } catch (error) {
      this.logger.error(`Error deleting row from ${tableName}`, error);
      throw error;
    }
  }

  /**
   * Syncs child rows for a one-to-many relation
   * Deletes all rows in Read DB matching the FK, then inserts fresh from Write DB
   */
  async syncChildRows(
    tableName: string,
    fkColumn: string,
    fkValue: string,
  ): Promise<void> {
    try {
      // 1. Delete existing rows in Read DB
      await this.readDataSource.query(
        `DELETE FROM ${this.quoteIdentifier(tableName)} WHERE ${this.quoteIdentifier(fkColumn)} = $1`,
        [fkValue],
      );

      // 2. Fetch rows from Write DB
      const rows = await this.writeDataSource.query(
        `SELECT * FROM ${this.quoteIdentifier(tableName)} WHERE ${this.quoteIdentifier(fkColumn)} = $1`,
        [fkValue],
      );

      if (rows.length === 0) return;

      // 3. Insert rows into Read DB
      const columns = Object.keys(rows[0]);
      const columnNames = columns.map((col) => this.quoteIdentifier(col)).join(', ');

      for (const row of rows) {
        const values = columns.map((col) => row[col]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        await this.readDataSource.query(
          `INSERT INTO ${this.quoteIdentifier(tableName)} (${columnNames}) VALUES (${placeholders})`,
          values,
        );
      }
      this.logger.debug(
        `Synced ${rows.length} child rows for ${tableName} where ${fkColumn}=${fkValue}`,
      );
    } catch (error) {
      this.logger.error(`Error syncing child rows for ${tableName}`, error);
      throw error;
    }
  }

  /**
   * Syncs ENUM types from write database to read database
   */
  private async syncEnums(): Promise<void> {
    try {
      // 1. Get all ENUMs and their values from Write DB
      const writeEnums = await this.writeDataSource.query(`
        SELECT 
          t.typname, 
          array_agg(e.enumlabel ORDER BY e.enumsortorder) as labels
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname
      `);

      for (const { typname, labels } of writeEnums) {
        // Handle array_agg returning string (e.g. "{PENDING,POSTED}") or actual array
        const labelsArray = Array.isArray(labels)
          ? labels
          : typeof labels === 'string'
            ? labels.replace(/{|}/g, '').split(',')
            : [];

        // 2. Check if ENUM exists in Read DB
        const exists = await this.readDataSource.query(
          `
          SELECT EXISTS (
            SELECT 1 
            FROM pg_type t 
            JOIN pg_namespace n ON n.oid = t.typnamespace 
            WHERE t.typname = $1 AND n.nspname = 'public'
          )
        `,
          [typname],
        );

        if (!exists[0].exists) {
          // 3. Create ENUM if it doesn't exist
          const values = labelsArray.map((l: string) => `'${l}'`).join(', ');
          this.logger.log(`Creating ENUM type: ${typname}`);
          await this.readDataSource.query(
            `CREATE TYPE ${this.quoteIdentifier(typname)} AS ENUM (${values})`,
          );
        } else {
          // 4. Sync missing values to existing ENUM
          const readLabels = await this.readDataSource.query(
            `
            SELECT e.enumlabel
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE t.typname = $1 AND n.nspname = 'public'
          `,
            [typname],
          );

          const readLabelSet = new Set(readLabels.map((r: any) => r.enumlabel));
          const missingLabels = labelsArray.filter(
            (label: string) => !readLabelSet.has(label),
          );

          for (const label of missingLabels) {
            this.logger.log(
              `Adding missing value '${label}' to ENUM ${typname} in Read DB`,
            );
            await this.readDataSource.query(`
              ALTER TYPE ${this.quoteIdentifier(typname)} ADD VALUE '${label}'
            `);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error syncing ENUMs', error);
      throw error;
    }
  }

  /**
   * Syncs the schema of a table by adding missing columns
   */
  private async syncTableSchema(tableName: string): Promise<void> {
    try {
      const writeColumns = await this.getTableColumns(
        this.writeDataSource,
        tableName,
      );
      const readColumns = await this.getTableColumns(
        this.readDataSource,
        tableName,
      );
      const primaryKeyColumns = await this.getPrimaryKeyColumns(
        this.writeDataSource,
        tableName,
      );

      const readColumnMap = new Map(
        readColumns.map((column) => [column.column_name, column]),
      );
      const writeColumnNames = new Set(writeColumns.map((column) => column.column_name));

      const primaryKeyTypeMismatch = writeColumns.some((column) => {
        if (!primaryKeyColumns.includes(column.column_name)) {
          return false;
        }

        const readColumn = readColumnMap.get(column.column_name);
        return readColumn !== undefined && readColumn.formatted_type !== column.formatted_type;
      });

      if (primaryKeyTypeMismatch) {
        this.logger.warn(
          `Rebuilding table ${tableName} because a primary key column type differs between write and read schemas`,
        );
        await this.rebuildTableFromWriteSchema(tableName);
        return;
      }

      // Drop columns from Read DB that no longer exist in Write DB
      for (const [readColName] of readColumnMap) {
        if (!writeColumnNames.has(readColName)) {
          this.logger.log(
            `Dropping obsolete column "${readColName}" from table "${tableName}" in Read DB`,
          );
          await this.readDataSource.query(
            `ALTER TABLE ${this.quoteIdentifier(tableName)} DROP COLUMN IF EXISTS ${this.quoteIdentifier(readColName)}`,
          );
          this.tablesDropped++;
        }
      }

      for (const col of writeColumns) {
        const readColumn = readColumnMap.get(col.column_name);

        if (readColumn === undefined) {
          // Column doesn't exist, add it
          const rowCountResult = await this.readDataSource.query(
            `SELECT COUNT(*)::int AS count FROM ${this.quoteIdentifier(tableName)}`,
          );
          const hasExistingRows = Number(rowCountResult?.[0]?.count || 0) > 0;

          const def = this.buildColumnDefinition(
            col,
            hasExistingRows && col.is_nullable === 'NO',
          );

          await this.readDataSource.query(
            `ALTER TABLE ${this.quoteIdentifier(tableName)} ADD COLUMN ${def}`,
          );
          this.logger.log(
            `Added column ${col.column_name} to table ${tableName} in Read DB`,
          );
          this.tablesCreated++;
        } else {
          if (readColumn.formatted_type !== col.formatted_type) {
            if (primaryKeyColumns.includes(col.column_name)) {
              this.logger.warn(
                `Skipping unsafe type cast for primary key ${tableName}.${col.column_name}; table rebuild is required`,
              );
              await this.rebuildTableFromWriteSchema(tableName);
              return;
            }

            try {
              await this.readDataSource.query(
                `ALTER TABLE ${this.quoteIdentifier(tableName)} ALTER COLUMN ${this.quoteIdentifier(col.column_name)} TYPE ${col.formatted_type} USING ${this.quoteIdentifier(col.column_name)}::${col.formatted_type}`,
              );
              this.logger.log(
                `Updated column ${col.column_name} in table ${tableName}: TYPE -> ${col.formatted_type}`,
              );
            } catch (err: any) {
              const code = err?.code ?? err?.driverError?.code ?? null;
              const message = err?.message ?? err?.driverError?.message ?? '';
              // 42846 = cannot cast type (incompatible conversion)
              if (code === '42846' || (typeof message === 'string' && message.includes('cannot cast type'))) {
                this.logger.warn(
                  `Type conversion failed for ${tableName}.${col.column_name} (${message}). Dropping and recreating column with target type.`,
                );

                // If this column is a primary key we cannot drop it safely; instruct a full rebuild
                if (primaryKeyColumns.includes(col.column_name)) {
                  this.logger.warn(
                    `Column ${col.column_name} is part of primary key for ${tableName}; performing full table rebuild instead.`,
                  );
                  await this.rebuildTableFromWriteSchema(tableName);
                  await this.syncTableData(tableName);
                  return;
                }

                // Drop the problematic column and recreate it using the write DB definition.
                // Use a relaxed NOT NULL when the table already has rows to allow data copy later.
                const rowCountResult = await this.readDataSource.query(
                  `SELECT COUNT(*)::int AS count FROM ${this.quoteIdentifier(tableName)}`,
                );
                const hasExistingRows = Number(rowCountResult?.[0]?.count || 0) > 0;

                const def = this.buildColumnDefinition(
                  col,
                  hasExistingRows && col.is_nullable === 'NO',
                );

                await this.readDataSource.query(
                  `ALTER TABLE ${this.quoteIdentifier(tableName)} DROP COLUMN IF EXISTS ${this.quoteIdentifier(col.column_name)}`,
                );

                await this.readDataSource.query(
                  `ALTER TABLE ${this.quoteIdentifier(tableName)} ADD COLUMN ${def}`,
                );

                this.logger.log(
                  `Recreated column ${col.column_name} on ${tableName} with type ${col.formatted_type}`,
                );

                return;
              }

              throw err;
            }
          }

          if (this.normalizeExpression(readColumn.column_default) !== this.normalizeExpression(col.column_default)) {
            if (col.column_default === null) {
              await this.readDataSource.query(
                `ALTER TABLE ${this.quoteIdentifier(tableName)} ALTER COLUMN ${this.quoteIdentifier(col.column_name)} DROP DEFAULT`,
              );
            } else {
              await this.readDataSource.query(
                `ALTER TABLE ${this.quoteIdentifier(tableName)} ALTER COLUMN ${this.quoteIdentifier(col.column_name)} SET DEFAULT ${col.column_default}`,
              );
            }
            this.logger.log(
              `Updated column ${col.column_name} in table ${tableName}: DEFAULT synced`,
            );
          }

          if (col.is_nullable === 'YES' && readColumn.is_nullable === 'NO') {
            await this.readDataSource.query(
              `ALTER TABLE ${this.quoteIdentifier(tableName)} ALTER COLUMN ${this.quoteIdentifier(col.column_name)} DROP NOT NULL`,
            );
            this.logger.log(
              `Updated column ${col.column_name} in table ${tableName}: DROPPED NOT NULL`,
            );
          }

          if (col.is_identity === 'YES' && readColumn.is_identity !== 'YES') {
            await this.readDataSource.query(
              `ALTER TABLE ${this.quoteIdentifier(tableName)} ALTER COLUMN ${this.quoteIdentifier(col.column_name)} ADD GENERATED ${col.identity_generation ?? 'BY DEFAULT'} AS IDENTITY`,
            );
            this.logger.log(
              `Updated column ${col.column_name} in table ${tableName}: ADDED IDENTITY`,
            );
          }

          if (
            col.is_identity === 'YES' &&
            readColumn.is_identity === 'YES' &&
            col.identity_generation &&
            readColumn.identity_generation !== col.identity_generation
          ) {
            await this.readDataSource.query(
              `ALTER TABLE ${this.quoteIdentifier(tableName)} ALTER COLUMN ${this.quoteIdentifier(col.column_name)} SET GENERATED ${col.identity_generation}`,
            );
          }

          if (col.is_identity === 'NO' && readColumn.is_identity === 'YES') {
            await this.readDataSource.query(
              `ALTER TABLE ${this.quoteIdentifier(tableName)} ALTER COLUMN ${this.quoteIdentifier(col.column_name)} DROP IDENTITY IF EXISTS`,
            );
            this.logger.log(
              `Updated column ${col.column_name} in table ${tableName}: DROPPED IDENTITY`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error syncing schema for table ${tableName}`, error);
      throw error;
    }
  }

  private async rebuildTableFromWriteSchema(tableName: string): Promise<void> {
    const createTableQuery = await this.getCreateTableStatement(tableName);

    await this.readDataSource.query(
      `DROP TABLE IF EXISTS ${this.quoteIdentifier(tableName)} CASCADE`,
    );
    await this.readDataSource.query(createTableQuery);

    this.tablesDropped++;
    this.tablesCreated++;
  }

  private async getTableNames(dataSource: DataSource): Promise<Array<{ table_name: string }>> {
    return dataSource.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name != 'migrations'
      ORDER BY table_name
    `);
  }

  private async dropObsoleteTables(
    writeTables: Array<{ table_name: string }>,
  ): Promise<void> {
    const readTables = await this.getTableNames(this.readDataSource);
    const writeTableSet = new Set(writeTables.map((table) => table.table_name));

    for (const { table_name } of readTables) {
      if (!writeTableSet.has(table_name)) {
        await this.readDataSource.query(
          `DROP TABLE IF EXISTS ${this.quoteIdentifier(table_name)} CASCADE`,
        );
        this.tablesDropped++;
        this.logger.log(`Dropped obsolete table ${table_name} from Read DB`);
      }
    }
  }

  private async syncTablesAndColumns(
    writeTables: Array<{ table_name: string }>,
  ): Promise<void> {
    for (const { table_name } of writeTables) {
      const tableExists = await this.readDataSource.query(
        `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = $1
        ) AS exists
      `,
        [table_name],
      );

      if (!tableExists[0].exists) {
        const createTableQuery = await this.getCreateTableStatement(table_name);
        await this.readDataSource.query(createTableQuery);
        this.tablesCreated++;
        this.logger.log(`Created table ${table_name} in Read DB`);
      } else {
        await this.syncTableSchema(table_name);
      }
    }
  }

  private async syncSequencesStructure(): Promise<void> {
    const writeSequences = await this.getSequences(this.writeDataSource);
    const readSequences = await this.getSequences(this.readDataSource);

    const readSequenceSet = new Set(
      readSequences.map((sequence) => sequence.sequence_name),
    );
    const writeSequenceSet = new Set(
      writeSequences.map((sequence) => sequence.sequence_name),
    );

    for (const sequence of readSequences) {
      if (!writeSequenceSet.has(sequence.sequence_name)) {
        await this.readDataSource.query(
          `DROP SEQUENCE IF EXISTS ${this.quoteIdentifier(sequence.sequence_name)} CASCADE`,
        );
        this.sequencesSynced++;
      }
    }

    for (const sequence of writeSequences) {
      const sequenceName = this.quoteIdentifier(sequence.sequence_name);
      const readSequence = readSequences.find(
        (candidate) => candidate.sequence_name === sequence.sequence_name,
      );

      if (!readSequence) {
        await this.readDataSource.query(this.buildCreateSequenceStatement(sequence));
        this.sequencesSynced++;
        continue;
      }

      if (
        this.normalizeDefinition(this.buildSequenceSignature(readSequence)) !==
        this.normalizeDefinition(this.buildSequenceSignature(sequence))
      ) {
        await this.readDataSource.query(
          this.buildAlterSequenceStatement(sequence),
        );
        this.sequencesSynced++;
      }
    }
  }

  private async syncSequenceOwnerships(
    writeTables: Array<{ table_name: string }>,
  ): Promise<void> {
    for (const { table_name } of writeTables) {
      const columns = await this.getTableColumns(this.writeDataSource, table_name);

      for (const column of columns) {
        const sequenceName = this.extractSequenceName(column.column_default);
        if (!sequenceName) {
          continue;
        }

        await this.readDataSource.query(
          `ALTER SEQUENCE ${this.quoteIdentifier(sequenceName)} OWNED BY ${this.quoteIdentifier(table_name)}.${this.quoteIdentifier(column.column_name)}`,
        );
      }
    }
  }

  private async syncSequenceValues(
    writeTables: Array<{ table_name: string }>,
  ): Promise<void> {
    for (const { table_name } of writeTables) {
      const columns = await this.getTableColumns(this.writeDataSource, table_name);

      for (const column of columns) {
        const sequenceName = this.extractSequenceName(column.column_default);
        if (!sequenceName) {
          continue;
        }

        const sequence = await this.getSequenceByName(this.writeDataSource, sequenceName);
        if (!sequence) {
          continue;
        }

        const maxResult = await this.readDataSource.query(
          `SELECT MAX(${this.quoteIdentifier(column.column_name)}) AS max_value FROM ${this.quoteIdentifier(table_name)}`,
        );

        const maxValueRaw = maxResult?.[0]?.max_value;
        const maxValue =
          maxValueRaw === null || maxValueRaw === undefined
            ? null
            : Number(maxValueRaw);
        const startValue = Number(sequence.start_value);
        const nextValue =
          maxValue !== null && Number.isFinite(maxValue) && maxValue >= startValue
            ? maxValue
            : startValue;
        const isCalled =
          maxValue !== null && Number.isFinite(maxValue) && maxValue >= startValue;

        await this.readDataSource.query(`SELECT setval($1, $2, $3)`, [
          this.quoteIdentifier(sequenceName),
          nextValue,
          isCalled,
        ]);
      }
    }
  }

  private async syncFinalNotNullColumns(
    writeTables: Array<{ table_name: string }>,
  ): Promise<void> {
    for (const { table_name } of writeTables) {
      const writeColumns = await this.getTableColumns(this.writeDataSource, table_name);
      const readColumns = await this.getTableColumns(this.readDataSource, table_name);
      const readColumnMap = new Map(
        readColumns.map((column) => [column.column_name, column]),
      );

      for (const column of writeColumns) {
        const readColumn = readColumnMap.get(column.column_name);
        if (!readColumn || column.is_nullable !== 'NO' || readColumn.is_nullable === 'NO') {
          continue;
        }

        const nullResult = await this.readDataSource.query(
          `SELECT COUNT(*)::int AS count FROM ${this.quoteIdentifier(table_name)} WHERE ${this.quoteIdentifier(column.column_name)} IS NULL`,
        );
        const nullCount = Number(nullResult?.[0]?.count || 0);

        if (nullCount > 0) {
          throw new Error(
            `Cannot apply NOT NULL to ${table_name}.${column.column_name}: ${nullCount} NULL values remain in Read DB`,
          );
        }

        await this.readDataSource.query(
          `ALTER TABLE ${this.quoteIdentifier(table_name)} ALTER COLUMN ${this.quoteIdentifier(column.column_name)} SET NOT NULL`,
        );
      }
    }
  }

  private async syncSecondaryIndexes(
    writeTables: Array<{ table_name: string }>,
  ): Promise<void> {
    const writeTableSet = new Set(writeTables.map((table) => table.table_name));
    const readIndexes = await this.getSecondaryIndexes(this.readDataSource);
    const writeIndexes = await this.getSecondaryIndexes(this.writeDataSource);

    const readIndexMap = new Map(
      readIndexes.map((index) => [index.index_name, index]),
    );
    const writeIndexMap = new Map(
      writeIndexes.map((index) => [index.index_name, index]),
    );

    for (const index of readIndexes) {
      if (!writeTableSet.has(index.table_name)) {
        continue;
      }

      const writeIndex = writeIndexMap.get(index.index_name);
      if (!writeIndex) {
        await this.readDataSource.query(
          `DROP INDEX IF EXISTS ${this.quoteIdentifier(index.index_name)}`,
        );
        this.indexesSynced++;
        continue;
      }

      if (
        this.normalizeDefinition(index.index_def) !==
        this.normalizeDefinition(writeIndex.index_def)
      ) {
        await this.readDataSource.query(
          `DROP INDEX IF EXISTS ${this.quoteIdentifier(index.index_name)}`,
        );
        await this.readDataSource.query(writeIndex.index_def);
        this.indexesSynced++;
      }
    }

    for (const index of writeIndexes) {
      if (!writeTableSet.has(index.table_name)) {
        continue;
      }

      if (!readIndexMap.has(index.index_name)) {
        await this.readDataSource.query(index.index_def);
        this.indexesSynced++;
      }
    }
  }

  private async syncForeignKeys(
    writeTables: Array<{ table_name: string }>,
  ): Promise<void> {
    const writeTableSet = new Set(writeTables.map((table) => table.table_name));
    const readForeignKeys = await this.getForeignKeys(this.readDataSource);
    const writeForeignKeys = await this.getForeignKeys(this.writeDataSource);

    const readForeignKeyMap = new Map(
      readForeignKeys.map((foreignKey) => [foreignKey.constraint_name, foreignKey]),
    );
    const writeForeignKeyMap = new Map(
      writeForeignKeys.map((foreignKey) => [foreignKey.constraint_name, foreignKey]),
    );

    for (const foreignKey of readForeignKeys) {
      if (!writeTableSet.has(foreignKey.table_name)) continue;

      const writeForeignKey = writeForeignKeyMap.get(foreignKey.constraint_name);
      if (!writeForeignKey) {
        await this.readDataSource.query(
          `ALTER TABLE ${this.quoteIdentifier(foreignKey.table_name)} DROP CONSTRAINT IF EXISTS ${this.quoteIdentifier(foreignKey.constraint_name)}`,
        );
        this.foreignKeysSynced++;
        continue;
      }

      if (
        this.normalizeDefinition(foreignKey.constraint_def) !==
        this.normalizeDefinition(writeForeignKey.constraint_def)
      ) {
        await this.readDataSource.query(
          `ALTER TABLE ${this.quoteIdentifier(foreignKey.table_name)} DROP CONSTRAINT IF EXISTS ${this.quoteIdentifier(foreignKey.constraint_name)}`,
        );

        await this.cleanOrphansForForeignKey(writeForeignKey);

        try {
          await this.readDataSource.query(this.buildAddForeignKeyStatement(writeForeignKey));
          this.foreignKeysSynced++;
        } catch (e: any) {
          this.logger.warn(`Skipped FK ${writeForeignKey.constraint_name} due to unresolvable conflicts. Boot continues.`);
        }
      }
    }

    for (const foreignKey of writeForeignKeys) {
      if (!writeTableSet.has(foreignKey.table_name)) continue;

      if (!readForeignKeyMap.has(foreignKey.constraint_name)) {
        await this.cleanOrphansForForeignKey(foreignKey);

        try {
          await this.readDataSource.query(this.buildAddForeignKeyStatement(foreignKey));
          this.foreignKeysSynced++;
        } catch (e: any) {
          this.logger.warn(`Skipped FK ${foreignKey.constraint_name} due to unresolvable conflicts. Boot continues.`);
        }
      }
    }
  }

  private async replaceTableData(
    tableName: string,
    rows: Array<Record<string, any>>,
  ): Promise<void> {
    await this.readDataSource.query(
      `DELETE FROM ${this.quoteIdentifier(tableName)}`,
    );

    if (rows.length === 0) {
      return;
    }

    const columns = Object.keys(rows[0]);
    const columnNames = columns.map((column) => this.quoteIdentifier(column)).join(', ');
    const identityColumns = await this.getIdentityColumns(this.writeDataSource, tableName);
    const identityClause = identityColumns.length > 0 ? ' OVERRIDING SYSTEM VALUE' : '';

    for (const row of rows) {
      const values = columns.map((column) => row[column]);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

      await this.readDataSource.query(
        `INSERT INTO ${this.quoteIdentifier(tableName)} (${columnNames})${identityClause} VALUES (${placeholders})`,
        values,
      );
    }
  }

  private async deleteOrphans(
    tableName: string,
    pkColumns: string[],
  ): Promise<void> {
    if (pkColumns.length === 0) {
      return;
    }

    // 1. Obtener SOLO las claves primarias de la base de datos de ESCRITURA
    const pkSelect = pkColumns.map((col) => this.quoteIdentifier(col)).join(', ');
    const writeRows = await this.writeDataSource.query(
      `SELECT ${pkSelect} FROM ${this.quoteIdentifier(tableName)}`
    );

    // Si la tabla origen está vacía, hacemos un barrido completo en lectura
    if (writeRows.length === 0) {
      await this.readDataSource.query(
        `DELETE FROM ${this.quoteIdentifier(tableName)}`
      );
      return;
    }

    // 2. Para claves primarias simples (Ej. "id"), usamos una consulta ultra rápida
    if (pkColumns.length === 1) {
      const pkName = pkColumns[0];
      const validIds = writeRows.map((row) => row[pkName]);

      await this.readDataSource.query(
        `DELETE FROM ${this.quoteIdentifier(tableName)} WHERE ${this.quoteIdentifier(pkName)} != ALL($1)`,
        [validIds]
      );
      return;
    }

    // 3. Para claves primarias compuestas (Fallback robusto en memoria)
    const readRows = await this.readDataSource.query(
      `SELECT ${pkSelect} FROM ${this.quoteIdentifier(tableName)}`
    );

    const writeSet = new Set(
      writeRows.map((row) => JSON.stringify(pkColumns.map((col) => row[col])))
    );

    const orphans = readRows.filter(
      (row) => !writeSet.has(JSON.stringify(pkColumns.map((col) => row[col])))
    );

    // Borrar huérfanos de PKs compuestas uno por uno
    for (const orphan of orphans) {
      const conditions = pkColumns
        .map((col, i) => `${this.quoteIdentifier(col)} = $${i + 1}`)
        .join(' AND ');
      const values = pkColumns.map((col) => orphan[col]);

      await this.readDataSource.query(
        `DELETE FROM ${this.quoteIdentifier(tableName)} WHERE ${conditions}`,
        values
      );
    }
  }

  private async getTableColumns(
    dataSource: DataSource,
    tableName: string,
  ): Promise<TableColumn[]> {
    return dataSource.query(
      `
        SELECT
          c.column_name,
          c.data_type,
          format_type(a.atttypid, a.atttypmod) AS formatted_type,
          c.character_maximum_length,
          c.numeric_precision,
          c.numeric_scale,
          c.datetime_precision,
          c.column_default,
          c.is_nullable,
          c.is_identity,
          c.identity_generation,
          c.identity_start,
          c.identity_increment,
          c.identity_minimum,
          c.identity_maximum,
          c.identity_cycle
        FROM information_schema.columns c
        JOIN pg_catalog.pg_class cls
          ON cls.relname = c.table_name
        JOIN pg_catalog.pg_namespace ns
          ON ns.oid = cls.relnamespace
          AND ns.nspname = c.table_schema
        JOIN pg_catalog.pg_attribute a
          ON a.attrelid = cls.oid
          AND a.attname = c.column_name
        WHERE c.table_schema = 'public'
          AND c.table_name = $1
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY c.ordinal_position
      `,
      [tableName],
    );
  }

  private async getSequences(
    dataSource: DataSource,
  ): Promise<SequenceInfo[]> {
    return dataSource.query(`
      SELECT
        c.relname AS sequence_name,
        n.nspname AS sequence_schema,
        format_type(s.seqtypid, NULL) AS data_type,
        s.seqstart::text AS start_value,
        s.seqmin::text AS minimum_value,
        s.seqmax::text AS maximum_value,
        s.seqincrement::text AS increment,
        s.seqcache::text AS cache_size,
        CASE WHEN s.seqcycle THEN 'YES' ELSE 'NO' END AS cycle_option
      FROM pg_catalog.pg_sequence s
      JOIN pg_catalog.pg_class c ON c.oid = s.seqrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
      ORDER BY c.relname
    `);
  }

  private async getSequenceByName(
    dataSource: DataSource,
    sequenceName: string,
  ): Promise<SequenceInfo | null> {
    const sequences = await this.getSequences(dataSource);
    return sequences.find((sequence) => sequence.sequence_name === sequenceName) ?? null;
  }

  private async getForeignKeys(
    dataSource: DataSource,
  ): Promise<ForeignKeyInfo[]> {
    return dataSource.query(
      `
        SELECT
          tc.constraint_name,
          tc.table_name,
          tc.table_schema,
          ref_ns.nspname AS foreign_table_schema,
          ref_cls.relname AS foreign_table_name,
          array_agg(src_att.attname ORDER BY key_cols.ordinality) AS column_names,
          array_agg(ref_att.attname ORDER BY key_cols.ordinality) AS foreign_column_names,
          pg_get_constraintdef(con.oid, true) AS constraint_def
        FROM information_schema.table_constraints tc
        JOIN pg_catalog.pg_constraint con
          ON con.conname = tc.constraint_name
          AND con.connamespace = (
            SELECT oid
            FROM pg_catalog.pg_namespace
            WHERE nspname = tc.constraint_schema
          )
        JOIN pg_catalog.pg_class src_cls
          ON src_cls.oid = con.conrelid
        JOIN pg_catalog.pg_namespace src_ns
          ON src_ns.oid = src_cls.relnamespace
        JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS key_cols(attnum, ordinality)
          ON true
        JOIN pg_catalog.pg_attribute src_att
          ON src_att.attrelid = con.conrelid
          AND src_att.attnum = key_cols.attnum
        JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS ref_cols(attnum, ordinality)
          ON ref_cols.ordinality = key_cols.ordinality
        JOIN pg_catalog.pg_attribute ref_att
          ON ref_att.attrelid = con.confrelid
          AND ref_att.attnum = ref_cols.attnum
        JOIN pg_catalog.pg_class ref_cls
          ON ref_cls.oid = con.confrelid
        JOIN pg_catalog.pg_namespace ref_ns
          ON ref_ns.oid = ref_cls.relnamespace
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        GROUP BY
          tc.constraint_name,
          tc.table_name,
          tc.table_schema,
          ref_ns.nspname,
          ref_cls.relname,
          con.oid
        ORDER BY tc.table_name, tc.constraint_name
      `,
    );
  }

  private async getSecondaryIndexes(
    dataSource: DataSource,
  ): Promise<SecondaryIndexInfo[]> {
    return dataSource.query(
      `
        SELECT
          idx.relname AS index_name,
          tbl.relname AS table_name,
          pg_get_indexdef(idx.oid) AS index_def
        FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class idx
          ON idx.oid = i.indexrelid
        JOIN pg_catalog.pg_class tbl
          ON tbl.oid = i.indrelid
        JOIN pg_catalog.pg_namespace ns
          ON ns.oid = tbl.relnamespace
        WHERE ns.nspname = 'public'
          AND NOT i.indisprimary
        ORDER BY tbl.relname, idx.relname
      `,
    );
  }

  private async getPrimaryKeyColumns(
    dataSource: DataSource,
    tableName: string,
  ): Promise<string[]> {
    const result = await dataSource.query(
      `
        SELECT a.attname
        FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_attribute a
          ON a.attrelid = i.indrelid
          AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass
          AND i.indisprimary
      `,
      [tableName],
    );

    return result.map((row: any) => row.attname);
  }

  private async getIdentityColumns(
    dataSource: DataSource,
    tableName: string,
  ): Promise<string[]> {
    const columns = await this.getTableColumns(dataSource, tableName);
    return columns
      .filter((column) => column.is_identity === 'YES')
      .map((column) => column.column_name);
  }

  private buildColumnDefinition(column: TableColumn, forceNullable = false): string {
    let definition = `${this.quoteIdentifier(column.column_name)} ${column.formatted_type}`;

    if (column.is_identity === 'YES') {
      definition += ` GENERATED ${column.identity_generation ?? 'BY DEFAULT'} AS IDENTITY`;
    }

    if (column.column_default && column.is_identity !== 'YES') {
      definition += ` DEFAULT ${column.column_default}`;
    }

    if (!forceNullable && column.is_nullable === 'NO') {
      definition += ' NOT NULL';
    }

    return definition;
  }

  private buildAddForeignKeyStatement(foreignKey: ForeignKeyInfo): string {
    return `ALTER TABLE ${this.quoteIdentifier(foreignKey.table_name)} ADD CONSTRAINT ${this.quoteIdentifier(foreignKey.constraint_name)} ${foreignKey.constraint_def}`;
  }

  private buildSequenceSignature(sequence: SequenceInfo): string {
    return [
      sequence.sequence_schema,
      sequence.sequence_name,
      sequence.data_type,
      sequence.start_value,
      sequence.minimum_value,
      sequence.maximum_value,
      sequence.increment,
      sequence.cache_size,
      sequence.cycle_option,
    ].join('|');
  }

  private buildCreateSequenceStatement(sequence: SequenceInfo): string {
    const sequenceName = this.quoteIdentifier(sequence.sequence_name);
    const cycleClause = sequence.cycle_option === 'YES' ? 'CYCLE' : 'NO CYCLE';

    return `
      CREATE SEQUENCE ${sequenceName}
        AS ${sequence.data_type}
        INCREMENT BY ${sequence.increment}
        MINVALUE ${sequence.minimum_value}
        MAXVALUE ${sequence.maximum_value}
        START WITH ${sequence.start_value}
        CACHE ${sequence.cache_size}
        ${cycleClause}
    `;
  }

  private buildAlterSequenceStatement(sequence: SequenceInfo): string {
    const sequenceName = this.quoteIdentifier(sequence.sequence_name);
    const cycleClause = sequence.cycle_option === 'YES' ? 'CYCLE' : 'NO CYCLE';

    return `
      ALTER SEQUENCE ${sequenceName}
        AS ${sequence.data_type}
        INCREMENT BY ${sequence.increment}
        MINVALUE ${sequence.minimum_value}
        MAXVALUE ${sequence.maximum_value}
        CACHE ${sequence.cache_size}
        ${cycleClause}
        RESTART WITH ${sequence.start_value}
    `;
  }

  /**
   * Drops all foreign keys in the Read DB temporarily to allow out-of-order data syncing.
   * They will be recreated at the end of the sync process.
   */
  private async dropAllForeignKeysFromReadDB(): Promise<void> {
    const readForeignKeys = await this.getForeignKeys(this.readDataSource);
    for (const foreignKey of readForeignKeys) {
      await this.readDataSource.query(
        `ALTER TABLE ${this.quoteIdentifier(foreignKey.table_name)} DROP CONSTRAINT IF EXISTS ${this.quoteIdentifier(foreignKey.constraint_name)}`
      );
    }
    if (readForeignKeys.length > 0) {
      this.logger.log(`Temporarily dropped ${readForeignKeys.length} foreign keys for data sync`);
    }
  }

  /**
   * Elimina registros huérfanos en la tabla hija que impedirían crear la llave foránea.
   */
  private async cleanOrphansForForeignKey(foreignKey: ForeignKeyInfo): Promise<void> {
    try {
      // Forzar a que siempre sea un Array, incluso si el driver de PG devuelve un string "{user_id}"
      const parseArray = (val: any) => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') return val.replace(/^{|}$/g, '').split(',');
        return [];
      };

      const childCols = parseArray(foreignKey.column_names);
      const parentCols = parseArray(foreignKey.foreign_column_names);

      if (childCols.length > 0 && childCols.length === parentCols.length) {
        const joinConditions = childCols.map((c, i) =>
          `${this.quoteIdentifier(foreignKey.foreign_table_name)}.${this.quoteIdentifier(parentCols[i])} = ${this.quoteIdentifier(foreignKey.table_name)}.${this.quoteIdentifier(c)}`
        ).join(' AND ');

        const nullChecks = childCols.map(c => `${this.quoteIdentifier(c)} IS NOT NULL`).join(' AND ');

        await this.readDataSource.query(`
          DELETE FROM ${this.quoteIdentifier(foreignKey.table_name)}
          WHERE (${nullChecks}) 
          AND NOT EXISTS (
            SELECT 1 FROM ${this.quoteIdentifier(foreignKey.foreign_table_name)}
            WHERE ${joinConditions}
          )
        `);
      }
    } catch (e: any) {
      this.logger.warn(`Could not clean orphans for ${foreignKey.constraint_name}: ${e.message}`);
    }
  }

  private extractSequenceName(columnDefault: string | null): string | null {
    if (!columnDefault) {
      return null;
    }

    const match = columnDefault.match(/nextval\('([^']+)'::regclass\)/);
    if (!match?.[1]) {
      return null;
    }

    const segments = match[1].split('.').map((segment) => segment.replace(/"/g, ''));
    return segments[segments.length - 1] ?? null;
  }

  private normalizeExpression(value: string | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return value.replace(/\s+/g, ' ').trim();
  }

  private normalizeDefinition(value: string | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return value.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private getDataSourceDatabaseName(dataSource: DataSource): string {
    const options = dataSource.options as { database?: string };
    return options.database ?? 'unknown';
  }

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}
