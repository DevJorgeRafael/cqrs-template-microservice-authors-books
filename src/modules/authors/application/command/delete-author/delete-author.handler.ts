import { CommandHandler, EventPublisher, ICommandHandler } from "@nestjs/cqrs";
import { DeleteAuthorCommand } from "./delete-author.command";
import { Logger, NotFoundException } from "@nestjs/common";
import { AuthorFactory } from "src/modules/authors/domain/factories/author.factory";
import { InjectRepository } from "@nestjs/typeorm";
import { Author } from "src/modules/authors/infrastructure/entities/author.entity";
import { Repository } from "typeorm";

@CommandHandler(DeleteAuthorCommand)
export class DeleteAuthorHandler implements ICommandHandler<DeleteAuthorCommand> {
    private readonly logger = new Logger(DeleteAuthorCommand.name);
    constructor(
        private readonly authorFactory: AuthorFactory,
        @InjectRepository(Author)
        private readonly authorRepository: Repository<Author>,
        private readonly publisher: EventPublisher
    ) {}

    async execute(command: DeleteAuthorCommand): Promise<Author> {
        try {
            const { id } = command;

            const currentAuthor = await this.authorRepository.findOneBy({ id })
            if (!currentAuthor) {
                throw new NotFoundException(`Author with ID ${id} not found.`)
            }

            const authorAggregate = this.authorFactory.fromEntity(currentAuthor);
            authorAggregate.delete();

            const deletedEntity = this.authorFactory.toEntity(authorAggregate);
            await this.authorRepository.delete(deletedEntity);

            const publish = this.publisher.mergeObjectContext(authorAggregate);
            publish.commit();

            this.logger.debug(`Author with ID ${id} deleted successfully.`);
            return deletedEntity;
        } catch (error) {
            this.logger.error(`Error deleting author with ID ${command.id}:`, error.stack);
            throw error;
        }
    }
}