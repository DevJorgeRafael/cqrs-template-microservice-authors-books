import { IsInt, IsOptional, IsString, MaxLength, MinLength, IsUUID } from "class-validator";

export class UpdateBookDto {
    @IsUUID()
    id: string;

    @IsOptional()
    @IsString()
    @MinLength(3)
    title?: string;

    @IsOptional()
    @IsString()
    @MinLength(10)
    @MaxLength(13)
    isbn?: string;

    @IsOptional()
    @IsInt()
    publishedYear?: number;
}