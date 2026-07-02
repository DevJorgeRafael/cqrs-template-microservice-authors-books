import { Controller, UseInterceptors } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { KafkaResponseInterceptor } from "src/common/interceptors/kafka-response.interceptor";
import { TOPICS_AUTHORS } from "../utils/topics.util";
import { CreateAuthorDto } from "../../application/dto/create-author.dto";
import { CreateAuthorCommand } from "../../application/command/create-author/create-author.command";
import { UpdateAuthorDto } from "../../application/dto/update-author.dto";

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
    deleteAuthor(@Payload() data) {
        return this.commandBus.execute(new DeleteAuthorCommand(data.id));
    }

    @MessagePattern(TOPICS_AUTHORS.GET_AUTHOR)
    getAuthor(@Payload() data) {
        return this.commandBus.execute(new GetAuthorQuery(data.id));
    }

    @MessagePattern(TOPICS_AUTHORS.GET_ALL_AUTHORS)
    getAllAuthors(@Payload() data) {
        return this.commandBus.execute(new GetAllAuthorsQuery());
    }
}