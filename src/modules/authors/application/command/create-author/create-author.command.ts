export class CreateAuthorCommand {
    constructor(
        public readonly firstName: string,
        public readonly lastName: string,
        public readonly birthDate?: Date,
    ) {}
}