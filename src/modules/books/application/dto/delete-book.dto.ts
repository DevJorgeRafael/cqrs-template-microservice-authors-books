import { IsNotEmpty, IsString } from "class-validator";

export class DeleteBookDto {
    @IsString()
    @IsNotEmpty()
    id: string;
}