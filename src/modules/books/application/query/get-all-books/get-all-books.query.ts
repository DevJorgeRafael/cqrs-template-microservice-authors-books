export class GetAllBooksQuery {
    constructor(
        public readonly page: number,
        public readonly limit: number,
        public readonly title?: string,
        public readonly isbn?: string,
        public readonly publishedYear?: number
    ) {}
}