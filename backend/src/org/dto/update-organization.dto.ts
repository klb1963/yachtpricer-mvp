import {
  IsOptional,
  IsString,
  IsEmail,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(200) contactName?: string;
  @IsOptional() @IsString() @MaxLength(64) contactPhone?: string;
  @IsOptional() @IsEmail() @MaxLength(200) contactEmail?: string;
  @IsOptional() @IsUrl() @MaxLength(300) websiteUrl?: string;
}
