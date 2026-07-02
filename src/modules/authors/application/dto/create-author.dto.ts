import { Type } from "class-transformer";
import { IsDate, IsNotEmpty, IsString, MinLength } from "class-validator";

export class CreateAuthorDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    firstName: string

    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    lastName: string
    
    @IsDate()
    @Type(() => Date)
    birthDate?: Date
}