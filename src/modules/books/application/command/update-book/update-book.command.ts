export class UpdateBookCommand {
    constructor (
        public readonly id: string,
        public readonly title?: string,
        public readonly isbn?: string,
        public readonly publishedYear?: number,
    ) {}
}