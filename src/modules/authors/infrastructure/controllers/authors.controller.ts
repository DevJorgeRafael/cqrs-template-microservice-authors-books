import { Controller, UseInterceptors } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { KafkaResponseInterceptor } from "src/common/interceptors/kafka-response.interceptor";
import { TOPICS_AUTHORS } from "../utils/topics.util";
import { CreateAuthorDto } from "../../application/dto/create-author.dto";
import { CreateAuthorCommand } from "../../application/command/create-author/create-author.command";
import { UpdateAuthorDto } from "../../application/dto/update-author.dto";
import { UpdateAuthorCommand } from "../../application/command/update-author/update-author.command";
import { DeleteAuthorCommand } from "../../application/command/delete-author/delete-author.command";
import { GetAuthorQuery } from "../../application/query/get-author/get-author.query";
import { GetAllAuthorsQuery } from "../../application/query/get-all-authors/get-all-authors.query";
import { deleteAuthorDto } from "../../application/dto/delete-author.dto";
import { GetAuthorDto } from "../../application/dto/get-author.dto";
import { GetAllAuthorsDto } from "../../application/dto/get-all-authors.dto";

@Controller()
@UseInterceptors(KafkaResponseInterceptor)
export class AuthorsController {
    constructor(
        private readonly commandBus: CommandBus
    ) {}

    @MessagePattern(TOPICS_AUTHORS.CREATE_AUTHOR)
    createAuthor(@Payload() data:CreateAuthorDto) {
        return this.commandBus.execute(new CreateAuthorCommand(data.firstName, data.lastName, data.birthDate));
    }

    @MessagePattern(TOPICS_AUTHORS.UPDATE_AUTHOR)
    updateAuthor(@Payload() data:UpdateAuthorDto) {
        return this.commandBus.execute(new UpdateAuthorCommand(data.id, data.firstName, data.lastName, data.birthDate));
    }

    @MessagePattern(TOPICS_AUTHORS.DELETE_AUTHOR)
    deleteAuthor(@Payload() data: deleteAuthorDto) {
        return this.commandBus.execute(new DeleteAuthorCommand(data.id));
    }

    @MessagePattern(TOPICS_AUTHORS.GET_AUTHOR)
    getAuthor(@Payload() data: GetAuthorDto) {
        return this.commandBus.execute(new GetAuthorQuery(data.id));
    }

    @MessagePattern(TOPICS_AUTHORS.GET_ALL_AUTHORS)
    getAllAuthors(@Payload() data: GetAllAuthorsDto) {
        return this.commandBus.execute(new GetAllAuthorsQuery(data.page, data.limit));
    }
}