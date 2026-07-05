import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { databaseConfig } from './common/config/database.config';
import { databaseReadConfig } from './common/config/database-read.config';
import { AuthorsModule } from './modules/authors/authors.module';
import { BooksModule } from './modules/books/books.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, databaseReadConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.getOrThrow<TypeOrmModuleOptions>('database'),
    }),
    TypeOrmModule.forRootAsync({
      name: 'read',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.getOrThrow<TypeOrmModuleOptions>('databaseRead'),
    }),
    CommonModule,
    AuthorsModule,
    BooksModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
