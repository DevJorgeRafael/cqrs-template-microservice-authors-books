import { CommandHandler, EventPublisher, ICommandHandler } from "@nestjs/cqrs";
import { DeleteBookCommand } from "./delete-book.command";
import { Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Book } from "src/modules/books/infrastructure/entities/book.entity";
import { BookFactory } from "src/modules/books/domain/factories/book.factory";

@CommandHandler(DeleteBookCommand)
export class DeleteBookHandler implements ICommandHandler<DeleteBookCommand> {
    private readonly logger = new Logger(DeleteBookCommand.name);
    constructor(
        private readonly bookFactory: BookFactory,
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
        private readonly publisher: EventPublisher,
    ){ }

    async execute(command: DeleteBookCommand): Promise<Book> {
        try {
            const { id } = command;

            const currentBook = await this.bookRepository.findOneBy({ id });
            
            if (!currentBook) {
                throw new NotFoundException(`Book with ID ${id} not found`)
            }

            const bookAggregate = this.bookFactory.fromEntity(currentBook);
            bookAggregate.delete();

            const deletedEntity = this.bookFactory.toEntity(bookAggregate);
            await this.bookRepository.delete(deletedEntity);

            const publish = this.publisher.mergeObjectContext(bookAggregate);
            publish.commit();

            this.logger.debug(`Book with ID ${id} deleted successfully`);
            return deletedEntity;
        } catch (error) {
            this.logger.error(`Error deleting book with ID ${command.id}:`, error.stack);
            throw error;
        }
    }
}