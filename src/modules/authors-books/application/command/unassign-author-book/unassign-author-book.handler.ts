import { CommandHandler, EventPublisher, ICommandHandler } from "@nestjs/cqrs";
import { UnassignAuthorBookCommand } from "./unassign-author-book.command";
import { Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AuthorsBooks } from "src/modules/authors-books/infrastructure/entities/authors-books.entity";
import { Repository } from "typeorm";
import { AuthorsBooksFactory } from "src/modules/authors-books/domain/factories/authors-books.factory";

@CommandHandler(UnassignAuthorBookCommand)
export class UnassignAuthorBookHandler implements ICommandHandler<UnassignAuthorBookCommand> {
    private readonly logger = new Logger(UnassignAuthorBookCommand.name);

    constructor(
        private readonly factory: AuthorsBooksFactory,
        @InjectRepository(AuthorsBooks)
        private readonly repository: Repository<AuthorsBooks>,
        private readonly publisher: EventPublisher,
    ) {}

    async execute(command: UnassignAuthorBookCommand): Promise<AuthorsBooks> {
        try {
            const { id } = command;

            const assignment = await this.repository.findOneBy({ id });
            if (!assignment) {
                throw new NotFoundException(`Assignment with ID ${id} not found.`);
            }

            const aggregate = this.factory.fromEntity(assignment);
            aggregate.delete();

            const entityToDelete = this.factory.toEntity(aggregate);
            await this.repository.delete(entityToDelete);

            const publish = this.publisher.mergeObjectContext(aggregate);
            publish.commit();

            this.logger.debug(`Assignment with ID ${id} deleted successfully.`);
            return entityToDelete;
        } catch (error) {
            this.logger.error(`Error deleting assignment with ID ${command.id}:`, error.stack);
            throw error;
        }
    }
}
