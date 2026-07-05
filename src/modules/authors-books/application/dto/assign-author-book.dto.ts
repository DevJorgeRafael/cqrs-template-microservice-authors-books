import { IsNotEmpty, IsUUID } from "class-validator";

export class AssignAuthorBookDto {
    @IsUUID()
    @IsNotEmpty()
    authorId: string;

    @IsUUID()
    @IsNotEmpty()
    bookId: string;
}
