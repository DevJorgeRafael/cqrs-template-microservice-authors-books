export class GetAllAuthorsQuery {
    constructor(
        public readonly page: number = 1,
        public readonly limit: number = 10,
        public readonly firstName?: string,
        public readonly lastName?: string,
        public readonly birthDate?: Date
    ) {}
}