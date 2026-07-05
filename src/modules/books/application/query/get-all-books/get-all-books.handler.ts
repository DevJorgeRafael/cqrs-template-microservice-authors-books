import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { GetAllBooksQuery } from "./get-all-books.query";
import { Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Book } from "src/modules/books/infrastructure/entities/book.entity";
import { Repository } from "typeorm";

@QueryHandler(GetAllBooksQuery)
export class GetAllBooksHandler implements IQueryHandler<GetAllBooksQuery> {
    private readonly logger = new Logger(GetAllBooksQuery.name)
    constructor(
        @InjectRepository(Book, 'read')
        private readonly bookRepository: Repository<Book>
    ) {}

    async execute(query: GetAllBooksQuery): Promise<any> {
        try {
            const { page, limit, ...filters } = query;
            const skip = (page - 1) * limit;

            const activeFilters = Object.fromEntries(
                Object.entries(filters).filter(([_, v]) => v !== undefined)
            );

            const [books, total] = await this.bookRepository.findAndCount({
                where: activeFilters,
                take: limit,
                skip,
                order: {
                    createdAt: 'DESC',
                },
            });

            this.logger.debug(`Books found successfully.`);
            return {
                data: books,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        } catch (error) {
            this.logger.error(`Error getting all books:`, error.stack);
            throw error;
        }
    }
}