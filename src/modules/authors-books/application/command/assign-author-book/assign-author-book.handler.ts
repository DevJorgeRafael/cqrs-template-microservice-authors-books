import { CommandHandler, EventPublisher, ICommandHandler } from "@nestjs/cqrs";
import { AssignAuthorBookCommand } from "./assign-author-book.command";
import { ConflictException, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AuthorsBooks } from "src/modules/authors-books/infrastructure/entities/authors-books.entity";
import { Author } from "src/modules/authors/infrastructure/entities/author.entity";
import { Book } from "src/modules/books/infrastructure/entities/book.entity";
import { Repository } from "typeorm";
import { AuthorsBooksFactory } from "src/modules/authors-books/domain/factories/authors-books.factory";

@CommandHandler(AssignAuthorBookCommand)
export class AssignAuthorBookHandler implements ICommandHandler<AssignAuthorBookCommand> {
    private readonly logger = new Logger(AssignAuthorBookCommand.name);

    constructor(
        private readonly factory: AuthorsBooksFactory,
        @InjectRepository(AuthorsBooks)
        private readonly repository: Repository<AuthorsBooks>,
        @InjectRepository(Author)
        private readonly authorRepository: Repository<Author>,
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
        private readonly publisher: EventPublisher,
    ) {}

    async execute(command: AssignAuthorBookCommand): Promise<AuthorsBooks> {
        this.logger.log(`Assigning author ${command.authorId} to book ${command.bookId}`);
        const { authorId, bookId } = command;

        const authorExists = await this.authorRepository.findOneBy({ id: authorId });
        if (!authorExists) {
            throw new NotFoundException(`Author with ID ${authorId} not found.`);
        }

        const bookExists = await this.bookRepository.findOneBy({ id: bookId });
        if (!bookExists) {
            throw new NotFoundException(`Book with ID ${bookId} not found.`);
        }

        const alreadyAssigned = await this.repository.findOneBy({ authorId, bookId });
        if (alreadyAssigned) {
            throw new ConflictException(`Author ${authorId} is already assigned to Book ${bookId}.`);
        }

        const aggregate = this.factory.create(authorId, bookId);
        const entity = this.factory.toEntity(aggregate);
        await this.repository.save(entity);

        const publish = this.publisher.mergeObjectContext(aggregate);
        publish.commit();

        return entity;
    }
}
