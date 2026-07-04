export class GetAllBooksQuery {
    constructor(
        public readonly page: number = 1,
        public readonly limit: number = 10,
        public readonly title?: string,
        public readonly isbn?: string,
        public readonly publishedYear?: number
    ) {}
}