import { Controller, UseInterceptors } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { KafkaResponseInterceptor } from "src/common/interceptors/kafka-response.interceptor";
import { TOPICS_AUTHORS_BOOKS } from "../utils/topics.util";
import { AssignAuthorBookDto } from "../../application/dto/assign-author-book.dto";
import { AssignAuthorBookCommand } from "../../application/command/assign-author-book/assign-author-book.command";
import { UnassignAuthorBookDto } from "../../application/dto/unassign-author-book.dto";
import { UnassignAuthorBookCommand } from "../../application/command/unassign-author-book/unassign-author-book.command";

@Controller()
@UseInterceptors(KafkaResponseInterceptor)
export class AuthorsBooksController {
    constructor(
        private readonly commandBus: CommandBus,
    ) {}

    @MessagePattern(TOPICS_AUTHORS_BOOKS.ASSIGN_AUTHOR_BOOK)
    assignAuthorBook(@Payload() data: AssignAuthorBookDto) {
        return this.commandBus.execute(new AssignAuthorBookCommand(data.authorId, data.bookId));
    }

    @MessagePattern(TOPICS_AUTHORS_BOOKS.UNASSIGN_AUTHOR_BOOK)
    unassignAuthorBook(@Payload() data: UnassignAuthorBookDto) {
        return this.commandBus.execute(new UnassignAuthorBookCommand(data.id));
    }
}
