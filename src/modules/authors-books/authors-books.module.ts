import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorsBooksController } from './infrastructure/controllers/authors-books.controller';
import { AuthorsBooks } from './infrastructure/entities/authors-books.entity';
import { Author } from '../authors/infrastructure/entities/author.entity';
import { Book } from '../books/infrastructure/entities/book.entity';
import { AuthorsBooksFactory } from './domain/factories/authors-books.factory';
import { CommandHandlers } from './application/command';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([AuthorsBooks, Author, Book]),
  ],
  controllers: [AuthorsBooksController],
  providers: [
    AuthorsBooksFactory,
    ...CommandHandlers,
  ],
})
export class AuthorsBooksModule {}
