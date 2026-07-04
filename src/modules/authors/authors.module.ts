import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorsController } from './infrastructure/controllers/authors.controller';
import { Author } from './infrastructure/entities/author.entity';
import { AuthorFactory } from './domain/factories/author.factory';

import { CommandHandlers } from './application/command';
import { QueryHandlers } from './application/query';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([Author]),
  ],
  controllers: [AuthorsController],
  providers: [
    AuthorFactory,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
})
export class AuthorsModule {}
