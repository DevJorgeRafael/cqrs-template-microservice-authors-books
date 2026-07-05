import { IsNotEmpty, IsUUID } from "class-validator";

export class UnassignAuthorBookDto {
    @IsUUID()
    @IsNotEmpty()
    id: string;
}
