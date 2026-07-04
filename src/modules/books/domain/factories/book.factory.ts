import { Injectable } from "@nestjs/common";
import { BookAggregate } from "../aggregates/book.aggregate";
import { randomUUID } from "crypto";
import { Book } from "../../infrastructure/entities/book.entity";

@Injectable()
export class BookFactory {
    create(
        title: string,
        isbn?: string,
        publishedYear?: number,
    ): BookAggregate {
        const id = randomUUID();
        const now = new Date();
        const aggregate = new BookAggregate(
            id,
            title,
            now,
            now,
            isbn,
            publishedYear
        );
        aggregate.create();
        return aggregate;
    }

    public toEntity(aggregate: BookAggregate): Book {
        const entity = new Book();
        entity.id = aggregate.getId();
        entity.title = aggregate.getTitle();
        entity.isbn = aggregate.getIsbn();
        entity.publishedYear = aggregate.getPublishedYear();
        entity.createdAt = aggregate.getCreatedAt();
        entity.updatedAt = aggregate.getUpdatedAt();
        return entity;
    }

    public fromEntity(entity: Book): BookAggregate {
        return new BookAggregate(
            entity.id,
            entity.title,
            entity.createdAt,
            entity.updatedAt,
            entity.isbn,
            entity.publishedYear,
        )
    }
}