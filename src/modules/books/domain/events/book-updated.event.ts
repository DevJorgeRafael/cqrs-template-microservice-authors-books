export class BookUpdatedEvent {
    constructor(
        public readonly id: string,
        public readonly title: string,
        public readonly isbn: string,
        public readonly publishedYear: number,
        public readonly updatedAt: Date,
    ) {}
}