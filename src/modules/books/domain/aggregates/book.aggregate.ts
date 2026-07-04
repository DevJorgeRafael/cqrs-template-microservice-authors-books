import { AggregateRoot } from "@nestjs/cqrs";
import { BookCreatedEvent } from "../events/book-created.event";
import { BookDeletedEvent } from "../events/book-deleted.event";
import { BookUpdatedEvent } from "../events/book-updated.event";

export class BookAggregate extends AggregateRoot {
    constructor(
        private readonly id: string,
        private title: string,
        private createdAt: Date,
        private updatedAt: Date,
        private isbn?: string,
        private publishedYear?: number,
    ) {
        super();
    }

    create() {
        this.apply(
            new BookCreatedEvent(
                this.id,
                this.title,
                this.createdAt,
                this.updatedAt,
                this.isbn,
                this.publishedYear
            )
        )
    }

    update(
        title?: string,
        isbn?: string,
        publishedYear?: number,
    ) {
        if (title !== undefined) {
            this.setTitle(title)
        }
        if (isbn !== undefined) {
            this.setIsbn(isbn)
        }
        if (publishedYear !== undefined) {
            this.setPublishedYear(publishedYear)
        }

        this.apply(
            new BookUpdatedEvent(
                this.id,
                this.title,
                this.updatedAt,
                this.isbn,
                this.publishedYear
            )
        )
    }

    delete() {
        this.apply(
            new BookDeletedEvent(
                this.id
            )
        )
    }

    // ------------ Getters --------------
    getId(): string {
        return this.id;
    }

    getTitle(): string {
        return this.title;
    }

    getIsbn(): string | undefined {
        return this.isbn;
    }

    getPublishedYear(): number | undefined {
        return this.publishedYear;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    getUpdatedAt(): Date {
        return this.updatedAt;
    }

    // ------------ Setters --------------
    setTitle(title: string): void {
        this.title = title;
        this.updatedAt = new Date();
    }

    setIsbn(isbn: string): void {
        this.isbn = isbn;
        this.updatedAt = new Date();
    }

    setPublishedYear(publishedYear: number): void {
        this.publishedYear = publishedYear;
        this.updatedAt = new Date();
    }

    setUpdatedAt(updatedAt: Date): void {
        this.updatedAt = updatedAt;
    }
}