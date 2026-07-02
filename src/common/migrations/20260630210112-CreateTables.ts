import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTables20260630210112 implements MigrationInterface {
    name = 'CreateTables20260630210112';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        await queryRunner.query(`
            CREATE TABLE "authors" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "first_name" varchar(100) NOT NULL,
                "last_name" varchar(100) NOT NULL,
                "birth_date" date,
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_authors_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "books" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "title" varchar(255) NOT NULL,
                "isbn" varchar(13),
                "published_year" integer,
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_books_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_books_isbn" UNIQUE ("isbn")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "authors_books" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "author_id" uuid NOT NULL,
                "book_id" uuid NOT NULL,
                "assigned_at" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_authors_books_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_authors_books_author" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_authors_books_book" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_unique_author_book" ON "authors_books" ("author_id", "book_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_unique_author_book"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "authors_books"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "books"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "authors"`);
    }
}
