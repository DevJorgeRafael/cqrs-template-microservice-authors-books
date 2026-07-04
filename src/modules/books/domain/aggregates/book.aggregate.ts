import { AggregateRoot } from "@nestjs/cqrs";
import { BookCreatedEvent } from "../events/book-created.event";
import { BookDeletedEvent } from "../events/book-deleted.event";

export class BookAggregate extends AggregateRoot {
    constructor(
        private readonly id: string,
        private title: string,
        private isbn: string,
        private publishedYear: number,
        private createdAt: Date,
        private updatedAt: Date,
    ) {
        super();
    }

    create() {
        this.apply(
            new BookCreatedEvent(
                this.id,
                this.title,
                this.isbn,
                this.publishedYear,
                this.createdAt,
                this.updatedAt,
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
            new BookCreatedEvent(
                this.id,
                this.title,
                this.isbn,
                this.publishedYear,
                this.createdAt,
                this.updatedAt,
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

    getIsbn(): string {
        return this.isbn;
    }

    getPublishedYear(): number {
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