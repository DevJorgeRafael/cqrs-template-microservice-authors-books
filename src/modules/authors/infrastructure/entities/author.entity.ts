import { AuthorsBooks } from "src/modules/authors-books/infrastructure/entities/authors-books.entity";
import { Column, Entity, OneToMany, PrimaryColumn } from "typeorm";

@Entity('authors')
export class Author {
    @PrimaryColumn('uuid', { name: 'id' })
    id: string;
    
    @Column({ name: 'first_name', type: 'varchar', nullable: false })
    firstName: string;

    @Column({ name: 'last_name', type: 'varchar', nullable: false })
    lastName: string;

    @Column({ name: 'birth_date', type: 'date', nullable: true })
    birthDate?: Date;

    @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    updatedAt: Date;

    @OneToMany(() => AuthorsBooks, (authorsBooks) => authorsBooks.author)
    authorsBooks: AuthorsBooks[];
}