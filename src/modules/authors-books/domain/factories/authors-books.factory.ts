import { Injectable } from "@nestjs/common";
import { AuthorsBooksAggregate } from "../aggregates/authors-books.aggregate";
import { randomUUID } from "crypto";
import { AuthorsBooks } from "../../infrastructure/entities/authors-books.entity";

@Injectable()
export class AuthorsBooksFactory {
    create(
        authorId: string,
        bookId: string,
    ): AuthorsBooksAggregate {
        const id = randomUUID();
        const now = new Date();
        const aggregate = new AuthorsBooksAggregate(
            id,
            authorId,
            bookId,
            now,
        );
        aggregate.create();
        return aggregate;
    }

    public toEntity(aggregate: AuthorsBooksAggregate): AuthorsBooks {
        const entity = new AuthorsBooks();
        entity.id = aggregate.getId();
        entity.authorId = aggregate.getAuthorId();
        entity.bookId = aggregate.getBookId();
        entity.assignedAt = aggregate.getAssignedAt();
        return entity;
    }

    public fromEntity(entity: AuthorsBooks): AuthorsBooksAggregate {
        return new AuthorsBooksAggregate(
            entity.id,
            entity.authorId,
            entity.bookId,
            entity.assignedAt,
        );
    }
}
