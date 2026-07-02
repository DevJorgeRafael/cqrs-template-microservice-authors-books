import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { GetAllAuthorsQuery } from "./get-all-authors.query";
import { InjectRepository } from "@nestjs/typeorm";
import { Author } from "src/modules/authors/infrastructure/entities/author.entity";
import { Logger } from "@nestjs/common";
import { Repository } from "typeorm";

@QueryHandler(GetAllAuthorsQuery)
export class getAllAuthorsHandler implements IQueryHandler<GetAllAuthorsQuery> {
    private readonly logger = new Logger(GetAllAuthorsQuery.name);
    constructor(
        @InjectRepository(Author)
        private readonly authorRepository: Repository<Author>
    ) {}

    async execute(query: GetAllAuthorsQuery): Promise<Author[]> {
        try {
            const { page, limit } = query;
            const skip = (page - 1) * limit;
            const authors = await this.authorRepository.find({
                skip,
                take: limit,
            });
            return authors;
        } catch (error) {
            this.logger.error(`Error getting all authors:`, error.stack);
            throw error;
        }
    }
}