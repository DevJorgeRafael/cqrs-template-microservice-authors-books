export class CreateBookCommand {
    constructor(
        public readonly title: string,
        public readonly isbn?: string,
        public readonly publishedYear?: number,
    ) {}
}