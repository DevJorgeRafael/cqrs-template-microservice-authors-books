import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { GetAuthorQuery } from "./get-author.query";
import { InjectRepository } from "@nestjs/typeorm";
import { Author } from "src/modules/authors/infrastructure/entities/author.entity";
import { Repository } from "typeorm";
import { Logger } from "@nestjs/common";

@QueryHandler(GetAuthorQuery)
export class GetAuthorHandler implements IQueryHandler<GetAuthorQuery> {
    private readonly logger = new Logger(GetAuthorQuery.name);
    constructor(
        @InjectRepository(Author)
        private readonly authorRepository: Repository<Author>,
    ) {}

    async execute(query: GetAuthorQuery): Promise<Author | null> {
        try {
            const { id } = query;
            const author = await this.authorRepository.findOneBy({ id });
            if (!author) {
                this.logger.debug(`Author with ID ${id} not found.`);
                return null;
            }

            this.logger.debug(`Author with ID ${id} found successfully.`);
            return author;
        } catch (error) {
            this.logger.error(`Error getting author with ID ${query.id}:`, error.stack);
            throw error;
        }
    }
}