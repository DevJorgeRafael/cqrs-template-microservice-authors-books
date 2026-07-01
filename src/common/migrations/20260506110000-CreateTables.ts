import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTables20260506110000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create ENUM types
        await queryRunner.query(`CREATE TYPE "kyc_status_enum" AS ENUM('ACCEPTED', 'PENDING', 'DECLINED', 'REVIEW', 'MANUAL', 'ERROR', 'NO_RESULT', 'PENDING_RESULT')`);
        await queryRunner.query(`CREATE TYPE "type_doc_enum" AS ENUM('DRIVERS_LICENSE', 'PASSPORT', 'ID_CARD', 'RESIDENCE_PERMIT', 'MILITARY_ID', 'VISA', 'HEALTH_CARD', 'TRAVEL_DOCUMENT', 'VOTER_ID', 'TAX_ID')`);
        await queryRunner.query(`CREATE TYPE "app_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'CONFLICT_DOCUMENT')`);
        await queryRunner.query(`CREATE TYPE "integration_status_enum" AS ENUM('ACTIVE', 'PENDING', 'SUSPENDED', 'KYC_FAILED', 'INACTIVE')`);

        // 2. Create Tables
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL, 
                "first_name" varchar(100) NOT NULL, 
                "second_name" varchar(100), 
                "first_last_name" varchar(100) NOT NULL, 
                "second_last_name" varchar(100), 
                "phone_country_code" varchar(10), 
                "phone_number" varchar(20), 
                "phone_verified" boolean NOT NULL DEFAULT false, 
                "country_code" varchar(5), 
                "alias" varchar(50), 
                "email" varchar(255) NOT NULL, 
                "email_verified" boolean NOT NULL DEFAULT false, 
                "password" varchar(255) NOT NULL, 
                "photo_url" text, 
                "birth_date" date, 
                "match_aml" boolean NOT NULL DEFAULT false, 
                "last_login_date" TIMESTAMP, 
                "app_status" "app_status_enum" NOT NULL DEFAULT 'ACTIVE', 
                "kyc_status" "kyc_status_enum" NOT NULL DEFAULT 'PENDING', 
                "document_number" varchar(50), 
                "type_document" "type_doc_enum", 
                "document_expiration_date" date, 
                "gender" varchar(10), 
                "is_deleted" boolean NOT NULL DEFAULT false, 
                "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
                CONSTRAINT "UQ_document_number" UNIQUE ("document_number"),
                CONSTRAINT "PK_users" PRIMARY KEY ("id")
            )
        `);

        // Unique index for (email, is_deleted)
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_UNIQUE_VERIFIED_EMAIL" ON "users" ("email") WHERE (email_verified = true AND is_deleted = false);`);

        await queryRunner.query(`
            CREATE TABLE "address" (
                "id" uuid NOT NULL, 
                "user_id" uuid NOT NULL, 
                "street" varchar(255), 
                "city" varchar(100), 
                "country" varchar(100), 
                "state" varchar(100), 
                "postal_code" varchar(20), 
                "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
                CONSTRAINT "PK_address" PRIMARY KEY ("id")
            )
        `);

        // --- NEW INTEGRATIONS TABLES ---
        await queryRunner.query(`
            CREATE TABLE "external_services" (
                "id" SERIAL NOT NULL, 
                "name" varchar(100) NOT NULL, 
                "description" varchar(255), 
                "is_active" boolean NOT NULL DEFAULT true, 
                "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
                CONSTRAINT "UQ_external_services_name" UNIQUE ("name"),
                CONSTRAINT "PK_external_services" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "user_integrations" (
                "id" uuid NOT NULL, 
                "user_id" uuid NOT NULL, 
                "service_id" integer NOT NULL, 
                "external_id" varchar(255), 
                "status" "integration_status_enum" NOT NULL DEFAULT 'PENDING', 
                "metadata" json, 
                "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
                CONSTRAINT "PK_user_integrations" PRIMARY KEY ("id")
            )
        `);

        // Unique index so a user only has one active record per external service
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_UNIQUE_USER_SERVICE" ON "user_integrations" ("user_id", "service_id");`);
        // -------------------------------

        await queryRunner.query(`
            CREATE TABLE "roles" (
                "id" SERIAL NOT NULL, 
                "name" varchar(50) NOT NULL, 
                "status" boolean NOT NULL DEFAULT true, 
                "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
                CONSTRAINT "UQ_roles_name" UNIQUE ("name"), 
                CONSTRAINT "PK_roles" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "permissions" (
                "id" SERIAL NOT NULL, 
                "name" varchar(100) NOT NULL, 
                "status" boolean NOT NULL DEFAULT true, 
                "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
                CONSTRAINT "UQ_permissions_name" UNIQUE ("name"), 
                CONSTRAINT "PK_permissions" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "user_role" (
                "id" SERIAL NOT NULL, 
                "user_id" uuid NOT NULL, 
                "role_id" integer NOT NULL, 
                "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
                CONSTRAINT "PK_user_role" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "role_permission" (
                "id" SERIAL NOT NULL, 
                "role_id" integer NOT NULL, 
                "permission_id" integer NOT NULL, 
                "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
                CONSTRAINT "PK_role_permission" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "sessions" (
                "id" uuid NOT NULL, 
                "user_id" uuid NOT NULL, 
                "device_name" varchar(255), 
                "ip_address" varchar(45), 
                "is_active" boolean NOT NULL DEFAULT true, 
                "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
                CONSTRAINT "PK_sessions" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "kyc_transactions" (
                "id" uuid NOT NULL, 
                "user_id" uuid NOT NULL, 
                "external_transaction_id" uuid, 
                "status" "kyc_status_enum", 
                "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
                CONSTRAINT "PK_kyc_transactions" PRIMARY KEY ("id")
            )
        `);

        // 3. Add Foreign Key Constraints
        await queryRunner.query(`ALTER TABLE "address" ADD CONSTRAINT "FK_address_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);

        // FKs for new integration tables
        await queryRunner.query(`ALTER TABLE "user_integrations" ADD CONSTRAINT "FK_integrations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_integrations" ADD CONSTRAINT "FK_integrations_service" FOREIGN KEY ("service_id") REFERENCES "external_services"("id") ON DELETE CASCADE`);

        await queryRunner.query(`ALTER TABLE "user_role" ADD CONSTRAINT "FK_user_role_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_role" ADD CONSTRAINT "FK_user_role_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "role_permission" ADD CONSTRAINT "FK_role_permission_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "role_permission" ADD CONSTRAINT "FK_role_permission_perm" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "FK_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "kyc_transactions" ADD CONSTRAINT "FK_kyc_transactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop tables in reverse order to avoid FK violations
        await queryRunner.query(`DROP TABLE "kyc_transactions"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP TABLE "role_permission"`);
        await queryRunner.query(`DROP TABLE "user_role"`);
        await queryRunner.query(`DROP TABLE "permissions"`);
        await queryRunner.query(`DROP TABLE "roles"`);

        // Drop new integration tables
        await queryRunner.query(`DROP TABLE "user_integrations"`);
        await queryRunner.query(`DROP TABLE "external_services"`);

        await queryRunner.query(`DROP TABLE "address"`);
        await queryRunner.query(`DROP TABLE "users"`);

        // Drop ENUMs
        await queryRunner.query(`DROP TYPE "integration_status_enum"`);
        await queryRunner.query(`DROP TYPE "app_status_enum"`);
        await queryRunner.query(`DROP TYPE "type_doc_enum"`);
        await queryRunner.query(`DROP TYPE "kyc_status_enum"`);
    }
}