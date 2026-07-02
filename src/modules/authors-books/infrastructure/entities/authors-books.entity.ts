import { Author } from "src/modules/authors/infrastructure/entities/author.entity";
import { Book } from "src/modules/books/infrastructure/entities/book.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

@Entity('authors_books')
export class AuthorsBooks {
    @PrimaryColumn('uuid', { name: 'id' })
    id: string;
    
    @Column({ name: 'author_id', type: 'uuid', nullable: false })
    authorId: string;

    @Column({ name: 'book_id', type: 'uuid', nullable: false })
    bookId: string;

    @Column({ name: 'assigned_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    assignedAt: Date;

    @ManyToOne(() => Author, (author) => author.authorsBooks)
    @JoinColumn({ name: 'author_id' })
    author: Author;

    @ManyToOne(() => Book, (book) => book.authorsBooks)
    @JoinColumn({ name: 'book_id' })
    book: Book;
}