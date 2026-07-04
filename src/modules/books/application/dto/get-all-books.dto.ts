import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class GetAllBooksDto {
    @IsInt()
    @Min(1)
    @IsOptional()
    page: number;

    @IsInt()
    @IsOptional()
    @Min(1)
    @Max(100)
    limit: number;

    @IsString()
    @IsOptional()
    @MinLength(3)
    title?: string;

    @IsString()
    @IsOptional()
    @MinLength(3)
    isbn?: string;

    @IsInt()
    @IsOptional()
    publishedYear?: number;
}