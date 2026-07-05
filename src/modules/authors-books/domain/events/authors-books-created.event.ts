export class AuthorsBooksCreatedEvent {
    constructor(
        public readonly id: string,
        public readonly authorId: string,
        public readonly bookId: string,
        public readonly assignedAt: Date,
    ) {}
}
