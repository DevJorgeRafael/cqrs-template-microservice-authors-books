import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { GetBookQuery } from "./get-book.query";
import { Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Book } from "src/modules/books/infrastructure/entities/book.entity";
import { Repository } from "typeorm";

@QueryHandler(GetBookQuery)
export class GetBookHandler implements IQueryHandler<GetBookQuery> {
    private readonly logger = new Logger(GetBookQuery.name)
    constructor (
        @InjectRepository(Book, 'read')
        private readonly bookRepository: Repository<Book>,
    ) {}

    async execute(query: GetBookQuery): Promise<any> {
        try {
            const { id } = query;
            const book = await this.bookRepository.findOne({
                where: { id },
                relations: {
                    authorsBooks: {
                        author: true,
                    },
                },
            });
            if (!book) {
                this.logger.debug(`Book with ID ${id} not found.`);
                throw new NotFoundException(`Book with ID ${id} not found.`);
            }

            const authors = book.authorsBooks?.map((ab) => ab.author).filter(Boolean) || [];
            const { authorsBooks, ...bookData } = book;

            this.logger.debug(`Book with ID ${id} found successfully.`);
            return {
                ...bookData,
                authors,
            };
        } catch (error) {
            this.logger.error(`Error getting book with ID ${query.id}:`, error.stack);
            throw error;
        }
    }
}