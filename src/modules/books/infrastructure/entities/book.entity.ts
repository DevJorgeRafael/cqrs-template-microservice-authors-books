import { AuthorsBooks } from "src/modules/authors-books/infrastructure/entities/authors-books.entity";
import { Column, Entity, OneToMany, PrimaryColumn } from "typeorm";

@Entity('books')
export class Book {
    @PrimaryColumn('uuid', { name: 'id' })
    id: string;

    @Column({ name: 'title', type: 'varchar', nullable: false })
    title: string;

    @Column({ name: 'isbn', type: 'varchar', nullable: true, unique: true })
    isbn?: string;

    @Column({ name: 'published_year', type: 'int', nullable: true })
    publishedYear?: number;

    @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    updatedAt: Date;

    @OneToMany(() => AuthorsBooks, (authorsBooks) => authorsBooks.book)
    authorsBooks: AuthorsBooks[];
}