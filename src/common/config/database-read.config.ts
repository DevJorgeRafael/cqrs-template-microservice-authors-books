import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

// Load .env file
dotenv.config();

export const databaseReadConfig = registerAs(
  'databaseRead',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.READ_DB_HOST || 'localhost',
    port: parseInt(process.env.READ_DB_PORT || '5432', 10),
    username: process.env.READ_DB_USERNAME || 'postgres',
    password: process.env.READ_DB_PASSWORD || 'password',
    database: process.env.READ_DB_NAME || 'ct_movements_r',
    entities: [
      __dirname + '/../../**/*.entity{.ts,.js}',
      __dirname + '/../../**/*.orm-entity{.ts,.js}',
    ],

    synchronize: false,
    logging:
      process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error'],
    ssl:
      process.env.READ_DB_SSL === 'true'
        ? {
          rejectUnauthorized: false,
        }
        : false,
    autoLoadEntities: true,
  }),
);

// DataSource for migrations CLI (Read Database)
export const AppDataSourceRead = new DataSource({
  type: 'postgres',
  host: process.env.READ_DB_HOST || 'localhost',
  port: parseInt(process.env.READ_DB_PORT || '5432', 10),
  username: process.env.READ_DB_USERNAME,
  password: process.env.READ_DB_PASSWORD,
  database: process.env.READ_DB_NAME,
  entities: [
    __dirname + '/../../**/*.entity{.ts,.js}',
    __dirname + '/../../**/*.orm-entity{.ts,.js}',
  ],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl:
    process.env.DB_READ_SSL === 'true'
      ? {
        rejectUnauthorized: false,
      }
      : false,
} as DataSourceOptions);
