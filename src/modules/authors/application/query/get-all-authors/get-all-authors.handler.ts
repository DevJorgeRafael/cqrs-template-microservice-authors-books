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
        @InjectRepository(Author, 'read')
        private readonly authorRepository: Repository<Author>
    ) {}

    async execute(query: GetAllAuthorsQuery): Promise<any> {
        try {
            const { page, limit, ...filters } = query;
            const skip = (page - 1) * limit;

            const activeFilters = Object.fromEntries(
                Object.entries(filters).filter(([_, v]) => v !== undefined)
            );

            const [authors, total] = await this.authorRepository.findAndCount({
                where: activeFilters,
                skip,
                take: limit,
                order: {
                    createdAt: "DESC"
                }
            });
            return {
                data: authors,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        } catch (error) {
            this.logger.error(`Error getting all authors:`, error.stack);
            throw error;
        }
    }
}