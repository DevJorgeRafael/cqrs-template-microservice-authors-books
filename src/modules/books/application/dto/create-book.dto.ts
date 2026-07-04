import { IsNotEmpty, IsString, IsInt, MaxLength, MinLength, IsOptional } from "class-validator";

export class createBookDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    title: string;

    @IsOptional()
    @IsString()
    @MinLength(10)
    @MaxLength(13)
    isbn: string;

    @IsOptional()
    @IsInt()
    publishedYear: number;
}