import { CommandBus, CommandHandler, EventPublisher, ICommandHandler } from "@nestjs/cqrs";
import { CreateAuthorCommand } from "./create-author.command";
import { Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Author } from "src/modules/authors/infrastructure/entities/author.entity";
import { Repository } from "typeorm";
import { AuthorCreatedFactory } from "src/modules/authors/domain/factories/author-created.factory";

@CommandHandler(CreateAuthorCommand)
export class CreateAuthorHandler implements ICommandHandler<CreateAuthorCommand> {
    private readonly log = new Logger(CreateAuthorCommand.name)
    constructor(
        private readonly authorCreatedFactory: AuthorCreatedFactory,
        @InjectRepository(Author)
        private readonly authorRepository: Repository<Author>,
        private readonly publisher: EventPublisher,
        private readonly commandBus: CommandBus
    ) {}

    async execute(command: CreateAuthorCommand): Promise<Author> {
        this.log.log(`Creating author: ${command.firstName} ${command.lastName}`);
        
        const { firstName, lastName, birthDate } = command;

        const authorAggregate = this.authorCreatedFactory.create(firstName, lastName, birthDate);
        authorAggregate.create();

        const entity = this.authorCreatedFactory.toEntity(authorAggregate);
        await this.authorRepository.save(entity);

        const publish = this.publisher.mergeObjectContext(authorAggregate);
        publish.commit();
        
        return entity;
    }
}