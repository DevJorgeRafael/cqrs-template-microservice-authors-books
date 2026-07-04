import { CommandHandler, EventPublisher, ICommandHandler } from "@nestjs/cqrs";
import { UpdateBookCommand } from "./update-book.command";
import { Logger, NotFoundException } from "@nestjs/common";
import { BookFactory } from "src/modules/books/domain/factories/book.factory";
import { InjectRepository } from "@nestjs/typeorm";
import { Book } from "src/modules/books/infrastructure/entities/book.entity";
import { Repository } from "typeorm";

@CommandHandler(UpdateBookCommand)
export class UpdateBookHandler implements ICommandHandler<UpdateBookCommand> {
    private readonly logger = new Logger(UpdateBookCommand.name);
    constructor(
        private readonly bookFactory: BookFactory,
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
        private readonly publisher: EventPublisher
    ) {}

    async execute(command: UpdateBookCommand): Promise<any> {
        try {
            const { id, title, isbn, publishedYear } = command;

            const currentBook = await this.bookRepository.findOneBy({ id })
            if (!currentBook) {
                throw new NotFoundException(`Book with ID ${id} not found`);
            }

            const bookAggregate = this.bookFactory.fromEntity(currentBook)

            bookAggregate.update(title, isbn, publishedYear)

            const updatedEntity = this.bookFactory.toEntity(bookAggregate)
            await this.bookRepository.update(id, updatedEntity)

            const publish = this.publisher.mergeObjectContext(bookAggregate);
            publish.commit()

            this.logger.log(`Book updated: ${id}`);
            return updatedEntity;
        } catch (error) {
            this.logger.error(`Error updating book: ${command.id}`, error.stack);
            throw error;
        }
    }
}