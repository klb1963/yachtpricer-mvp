// backend/src/geo/dto/get-locations.dto.ts

import { IsOptional, IsString, IsIn, IsInt, Min } from 'class-validator';

export class GetLocationsDto {
  @IsOptional()
  @IsString()
  q?: string; // поиск по name/alias

  @IsOptional()
  @IsString()
  countryCode?: string; // ISO-2

  @IsOptional()
  @IsIn(['name', 'countryCode'])
  orderBy?: 'name' | 'countryCode';

  @IsOptional()
  @IsInt()
  @Min(1)
  take?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;
}
