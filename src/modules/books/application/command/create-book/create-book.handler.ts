import { CommandHandler, EventPublisher, ICommandHandler } from "@nestjs/cqrs";
import { CreateBookCommand } from "./create-book.command";
import { BadRequestException, Logger } from "@nestjs/common";
import { BookFactory } from "src/modules/books/domain/factories/book.factory";
import { InjectRepository } from "@nestjs/typeorm";
import { Book } from "src/modules/books/infrastructure/entities/book.entity";
import { Repository } from "typeorm";

@CommandHandler(CreateBookCommand)
export class CreateBookHandler implements ICommandHandler<CreateBookCommand> {
    private readonly logger = new Logger(CreateBookCommand.name)
    constructor(
        private readonly bookFactory: BookFactory,
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
        private readonly publisher: EventPublisher
    ) {}

    async execute(command: CreateBookCommand): Promise<any> {
        this. logger.log(`Creating book: ${command.title}`);

        const { title, isbn, publishedYear } = command;
        const existingBook = await this.bookRepository.findOne({
            where: { isbn }
        })

        if (existingBook) {
            throw new BadRequestException(`Book with ISBN ${isbn} already exists`);
        }

        const bookAggregate = this.bookFactory.create(title, isbn, publishedYear);
        bookAggregate.create();

        const entity = this.bookFactory.toEntity(bookAggregate);
        await this.bookRepository.save(entity);

        const publish = this.publisher.mergeObjectContext(bookAggregate);
        publish.commit();

        return entity;        
    }
}