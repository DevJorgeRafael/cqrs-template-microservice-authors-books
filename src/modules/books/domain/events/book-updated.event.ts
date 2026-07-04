export class BookUpdatedEvent {
    constructor(
        public readonly id: string,
        public readonly title: string,
        public readonly updatedAt: Date,
        public readonly isbn?: string,
        public readonly publishedYear?: number,
    ) {}
}