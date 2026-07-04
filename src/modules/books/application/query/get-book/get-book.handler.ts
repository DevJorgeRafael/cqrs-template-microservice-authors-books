import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { GetBookQuery } from "./get-book.query";
import { Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Book } from "src/modules/books/infrastructure/entities/book.entity";
import { Repository } from "typeorm";

@QueryHandler(GetBookQuery)
export class GetBookHandler implements IQueryHandler<GetBookQuery> {
    private readonly logger = new Logger(GetBookQuery.name)
    constructor (
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
    ) {}

    async execute(query: GetBookQuery): Promise<Book | null> {
        try {
            const { id } = query;
            const book = await this.bookRepository.findOneBy({ id });
            if (!book) {
                this.logger.debug(`Book with ID ${id} not found.`);
                return null;
            }

            this.logger.debug(`Book with ID ${id} found successfully.`);
            return book;
        } catch (error) {
            this.logger.error(`Error getting book with ID ${query.id}:`, error.stack);
            throw error;
        }
    }
}