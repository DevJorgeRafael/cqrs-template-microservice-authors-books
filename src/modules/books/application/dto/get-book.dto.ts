import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class GetBookDto {
    @IsUUID()
    id: string;
}