export class AssignAuthorBookCommand {
    constructor(
        public readonly authorId: string,
        public readonly bookId: string,
    ) {}
}
