import { Injectable } from "@nestjs/common";
import { AuthorAggregate } from "../aggregates/author.aggregate";
import { randomUUID } from "crypto";
import { Author } from "../../infrastructure/entities/author.entity";

@Injectable()
export class AuthorCreatedFactory {
    create(
        firstName: string,
        lastName: string,
        birthDate?: Date
    ): AuthorAggregate {
        const id = randomUUID();
        const now = new Date();
        const aggregate = new AuthorAggregate(
            id,
            firstName,
            lastName,
            now,
            now,
            birthDate
        );
        aggregate.create();
        return aggregate;
    }

    public toEntity(aggregate: AuthorAggregate): Author {
        const entity = new Author();
        entity.id = aggregate.getId();
        entity.firstName = aggregate.getFirstName();
        entity.lastName = aggregate.getLastName();
        entity.birthDate = aggregate.getBirthDate();
        entity.createdAt = aggregate.getCreatedAt();
        entity.updatedAt = aggregate.getUpdatedAt();
        return entity;
    }

    public fromEntity(entity: Author): AuthorAggregate {
        return new AuthorAggregate(
            entity.id,
            entity.firstName,
            entity.lastName,
            entity.createdAt,
            entity.updatedAt,
            entity.birthDate
        );
    }
}