import { CommandBus, CommandHandler, EventPublisher, ICommandHandler } from "@nestjs/cqrs";
import { UpdateAuthorCommand } from "./update-author.command";
import { Logger, NotFoundException } from "@nestjs/common";
import { Author } from "src/modules/authors/infrastructure/entities/author.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuthorFactory } from "src/modules/authors/domain/factories/author.factory";

@CommandHandler(UpdateAuthorCommand)
export class UpdateAuthorHandler implements ICommandHandler<UpdateAuthorCommand> {
    private readonly logger = new Logger(UpdateAuthorCommand.name);
    constructor(
        private readonly authorFactory: AuthorFactory,
        @InjectRepository(Author)
        private readonly authorRepository: Repository<Author>,
        private readonly publisher: EventPublisher,
    ) {}

    async execute(command: UpdateAuthorCommand): Promise<Author> {
        try {
            const { id, firstName, lastName, birthDate } = command;
            
            const currentAuthor = await this.authorRepository.findOneBy({ id })
            if (!currentAuthor) {
                throw new NotFoundException(`Author with ID ${id} not found.`);
            }

            const authorAggregate = this.authorFactory.fromEntity(currentAuthor);

            authorAggregate.update(firstName, lastName, birthDate);

            const updatedEntity = this.authorFactory.toEntity(authorAggregate);
            await this.authorRepository.save(updatedEntity);

            const publish = this.publisher.mergeObjectContext(authorAggregate);
            publish.commit();

            this.logger.debug(`Author with ID ${id} updated successfully.`);
            return updatedEntity;
        } catch (error) {
            this.logger.error(`Error updating author with ID ${command.id}:`, error.stack);
            throw error;
        }        
    }
}