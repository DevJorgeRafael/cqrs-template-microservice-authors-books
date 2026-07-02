import { AggregateRoot } from "@nestjs/cqrs";
import { AuthorCreatedEvent } from "../events/author-created.event";
import { AuthorUpdatedEvent } from "../events/author-updated.event";

export class AuthorAggregate extends AggregateRoot {
    constructor(
        private readonly id: string,
        private firstName: string,
        private lastName: string,
        private readonly createdAt: Date,
        private updatedAt: Date,
        private birthDate?: Date
    ) {
        super();
    }

    create() {
        this.apply(
            new AuthorCreatedEvent(
                this.id,
                this.firstName,
                this.lastName,
                this.createdAt,
                this.updatedAt,
                this.birthDate
            )
        )
    }

    update(firstName: string, lastName: string, birthDate?: Date) {
        this.setFirstName(firstName);
        this.setLastName(lastName);
        this.setBirthDate(birthDate);

        this.apply(
            new AuthorUpdatedEvent(
                this.id,
                this.firstName,
                this.lastName,
                this.updatedAt,
                this.birthDate
            )
        )
    }

    // ------------ Getters --------------
    getId(): string {
        return this.id;
    }

    getFirstName(): string {
        return this.firstName;
    }

    getLastName(): string {
        return this.lastName;
    }

    getBirthDate(): Date | undefined {
        return this.birthDate;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    getUpdatedAt(): Date {
        return this.updatedAt;
    }

    // ------------ Setters --------------
    setFirstName(firstName: string): void {
        this.firstName = firstName;
        this.updatedAt = new Date();
    }

    setLastName(lastName: string): void {
        this.lastName = lastName;
        this.updatedAt = new Date();
    }

    setBirthDate(birthDate: Date | undefined): void {
        this.birthDate = birthDate;
        this.updatedAt = new Date();
    }

    setUpdatedAt(updatedAt: Date): void {
        this.updatedAt = updatedAt;
    }
}