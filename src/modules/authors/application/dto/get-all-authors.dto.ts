import { Type } from "class-transformer";
import { IsDate, IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class GetAllAuthorsDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit: number;

    @IsOptional()
    @IsString()
    @MinLength(3)
    firstName?: string;

    @IsOptional()
    @IsString()
    @MinLength(3)
    lastName?: string;

    @Type(() => Date)
    @IsOptional()
    @IsDate()
    birthDate?: Date;
}