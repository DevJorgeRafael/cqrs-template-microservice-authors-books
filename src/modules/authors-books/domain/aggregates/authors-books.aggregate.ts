import { AggregateRoot } from "@nestjs/cqrs";
import { AuthorsBooksCreatedEvent } from "../events/authors-books-created.event";
import { AuthorsBooksDeletedEvent } from "../events/authors-books-deleted.event";

export class AuthorsBooksAggregate extends AggregateRoot {
    constructor(
        private readonly id: string,
        private readonly authorId: string,
        private readonly bookId: string,
        private readonly assignedAt: Date,
    ) {
        super();
    }

    create() {
        this.apply(
            new AuthorsBooksCreatedEvent(
                this.id,
                this.authorId,
                this.bookId,
                this.assignedAt,
            )
        );
    }

    delete(): void {
        this.apply(
            new AuthorsBooksDeletedEvent(
                this.id,
            )
        );
    }

    // ------------ Getters --------------
    getId(): string {
        return this.id;
    }

    getAuthorId(): string {
        return this.authorId;
    }

    getBookId(): string {
        return this.bookId;
    }

    getAssignedAt(): Date {
        return this.assignedAt;
    }
}
