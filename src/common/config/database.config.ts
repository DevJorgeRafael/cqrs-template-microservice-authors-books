import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

// Load .env file
dotenv.config();

export const databaseConfig = registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.WRITE_DB_HOST || 'localhost',
    port: parseInt(process.env.WRITE_DB_PORT || '5432', 10),
    username: process.env.WRITE_DB_USERNAME || 'postgres',
    password: process.env.WRITE_DB_PASSWORD || 'password',
    database: process.env.WRITE_DB_NAME || 'ct_movements_w',
    entities: [
      __dirname + '/../../**/*.entity{.ts,.js}',
      __dirname + '/../../**/*.orm-entity{.ts,.js}',
    ],

    migrations: [__dirname + '/../migrations/*{.ts,.js,.tsx}'],
    synchronize: false,
    logging:
      process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error'],
    ssl:
      process.env.DB_WRITE_SSL === 'true'
        ? {
            rejectUnauthorized: false,
          }
        : false,
    migrationsRun: false,
    autoLoadEntities: true,
  }),
);

// DataSource for migrations CLI
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.WRITE_DB_HOST || 'localhost',
  port: parseInt(process.env.WRITE_DB_PORT || '5432', 10),
  username: process.env.WRITE_DB_USERNAME || 'postgres',
  password: process.env.WRITE_DB_PASSWORD || 'password',
  database: process.env.WRITE_DB_NAME || 'ct_movements_w',
  entities: [
    __dirname + '/../../**/*.entity{.ts,.js}',
    __dirname + '/../../**/*.orm-entity{.ts,.js}',
  ],
  migrations: [__dirname + '/../migrations/*{.ts,.js,.tsx}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl:
    process.env.DB_WRITE_SSL === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : false,
} as DataSourceOptions);
