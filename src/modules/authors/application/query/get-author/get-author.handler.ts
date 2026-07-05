import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { GetAuthorQuery } from "./get-author.query";
import { InjectRepository } from "@nestjs/typeorm";
import { Author } from "src/modules/authors/infrastructure/entities/author.entity";
import { Repository } from "typeorm";
import { Logger, NotFoundException } from "@nestjs/common";

@QueryHandler(GetAuthorQuery)
export class GetAuthorHandler implements IQueryHandler<GetAuthorQuery> {
    private readonly logger = new Logger(GetAuthorQuery.name);
    constructor(
        @InjectRepository(Author)
        private readonly authorRepository: Repository<Author>,
    ) {}

    async execute(query: GetAuthorQuery): Promise<any> {
        try {
            const { id } = query;
            const author = await this.authorRepository.findOne({
                where: { id },
                relations: {
                    authorsBooks: {
                        book: true,
                    },
                },
            });
            if (!author) {
                this.logger.debug(`Author with ID ${id} not found.`);
                throw new NotFoundException(`Author with ID ${id} not found.`);
            }

            const books = author.authorsBooks?.map((ab) => ab.book).filter(Boolean) || [];
            const { authorsBooks, ...authorData } = author;

            this.logger.debug(`Author with ID ${id} found successfully.`);
            return {
                ...authorData,
                books,
            };
        } catch (error) {
            this.logger.error(`Error getting author with ID ${query.id}:`, error.stack);
            throw error;
        }
    }
}