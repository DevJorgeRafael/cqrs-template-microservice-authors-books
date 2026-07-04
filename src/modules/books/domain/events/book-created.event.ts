export class BookCreatedEvent {
    constructor(
        public readonly id: string,
        public readonly title: string,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly isbn?: string,
        public readonly publishedYear?: number,
    ) {}
}