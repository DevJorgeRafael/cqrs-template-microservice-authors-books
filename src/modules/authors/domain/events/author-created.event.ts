export class AuthorCreatedEvent {
    constructor(
        public readonly id: string,
        public readonly firstName: string,
        public readonly lastName: string,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly birthDate?: Date
    ) {}
}