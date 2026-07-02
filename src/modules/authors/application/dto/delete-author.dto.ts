import { IsUUID } from "class-validator";

export class deleteAuthorDto {
    @IsUUID()
    id: string;
}