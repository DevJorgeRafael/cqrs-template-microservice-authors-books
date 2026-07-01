const fs = require('fs');
const path = require('path');

// Extract migration name from arguments
const migrationName = process.argv[2];

if (!migrationName) {
  console.error('\x1b[31mError: Please provide a migration name.\x1b[0m');
  console.error('Usage: pnpm run migration:make <MigrationName>');
  process.exit(1);
}

// Generate timestamp: YYYYMMDDHHmmss
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
const seconds = String(now.getSeconds()).padStart(2, '0');
const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;

const className = `${migrationName}${timestamp}`;
const fileName = `${timestamp}-${migrationName}.ts`;
const targetDir = path.join(__dirname, '..', 'src', 'common', 'migrations');
const filePath = path.join(targetDir, fileName);

// Migration template content
const template = `import { MigrationInterface, QueryRunner } from 'typeorm';

export class ${className} implements MigrationInterface {
    name = '${className}';

    public async up(queryRunner: QueryRunner): Promise<void> {
        
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        
    }
}
`;

try {
  // Ensure the target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Write the file
  fs.writeFileSync(filePath, template, 'utf8');
  console.log(`\x1b[32mCreated migration: src/common/migrations/${fileName}\x1b[0m`);
} catch (error) {
  console.error('\x1b[31mFailed to create migration file:\x1b[0m', error);
  process.exit(1);
}
