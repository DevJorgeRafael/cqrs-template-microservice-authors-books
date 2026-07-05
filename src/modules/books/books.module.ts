import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BooksController } from './infrastructure/controllers/book.controller';
import { Book } from './infrastructure/entities/book.entity';
import { BookFactory } from './domain/factories/book.factory';
import { CommandHandlers } from './application/command';
import { QueryHandlers } from './application/query';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([Book]),
  ],
  controllers: [BooksController],
  providers: [
    BookFactory,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
})
export class BooksModule {}
