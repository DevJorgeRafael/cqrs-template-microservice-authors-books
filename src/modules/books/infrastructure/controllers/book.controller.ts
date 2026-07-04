import { Controller, UseInterceptors } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { KafkaResponseInterceptor } from "src/common/interceptors/kafka-response.interceptor";
import { TOPICS_BOOKS } from "../utils/topics.util";
import { createBookDto } from "../../application/dto/create-book.dto";
import { CreateBookCommand } from "../../application/command/create-book/create-book.command";
import { UpdateBookDto } from "../../application/dto/update-book.dto";
import { UpdateBookCommand } from "../../application/command/update-book/update-book.command";
import { DeleteBookDto } from "../../application/dto/delete-book.dto";
import { DeleteBookCommand } from "../../application/command/delete-book/delete-book.command";
import { GetBookDto } from "../../application/dto/get-book.dto";
import { GetAllBooksDto } from "../../application/dto/get-all-books.dto";
import { GetBookQuery } from "../../application/query/get-book/get-book.query";
import { GetAllBooksQuery } from "../../application/query/get-all-books/get-all-books.query";

@Controller()
@UseInterceptors(KafkaResponseInterceptor)
export class BooksController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus
    ) {}

    @MessagePattern(TOPICS_BOOKS.CREATE_BOOK)
    createBook(@Payload() data: createBookDto) {
        return this.commandBus.execute(new CreateBookCommand(data.title, data.isbn, data.publishedYear));
    }

    @MessagePattern(TOPICS_BOOKS.UPDATE_BOOK)
    updateBook(@Payload() data: UpdateBookDto) {
        return this.commandBus.execute(new UpdateBookCommand(data.id, data.title, data.isbn, data.publishedYear));
    }

    @MessagePattern(TOPICS_BOOKS.DELETE_BOOK)
    deleteBook(@Payload() data: DeleteBookDto) {
        return this.commandBus.execute(new DeleteBookCommand(data.id));
    }

    @MessagePattern(TOPICS_BOOKS.GET_BOOK)
    getBook(@Payload() data: GetBookDto) {
        return this.queryBus.execute(new GetBookQuery(data.id));
    }

    @MessagePattern(TOPICS_BOOKS.GET_ALL_BOOKS)
    getAllBooks(@Payload() data: GetAllBooksDto) {
        return this.queryBus.execute(new GetAllBooksQuery(data.page, data.limit, data.title, data.isbn, data.publishedYear));
    }
}