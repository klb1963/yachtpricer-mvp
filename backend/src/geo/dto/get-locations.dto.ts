// backend/src/geo/dto/get-locations.dto.ts
import { IsOptional, IsString, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetLocationsDto {
  @IsOptional()
  @IsString()
  q?: string; // поиск по name/alias

  @IsOptional()
  @IsString()
  countryCode?: string; // ISO-2

  @IsOptional()
  @IsIn(['name', 'countryCode'])
  orderBy: 'name' | 'countryCode' = 'name'; // дефолт прямо тут

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take: number = 50; // дефолт 50

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip: number = 0; // дефолт 0
}
