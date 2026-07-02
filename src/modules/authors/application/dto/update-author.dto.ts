import { Type } from "class-transformer";
import { IsDate, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class UpdateAuthorDto {
    @IsUUID()
    id: string

    @IsOptional()
    @IsString()
    @MinLength(3)
    firstName?: string
    
    @IsOptional()
    @IsString()
    @MinLength(3)
    lastName?: string
    
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    birthDate?: Date
}