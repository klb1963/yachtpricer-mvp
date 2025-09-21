// backend/src/filters/dto/get-filters.query.ts
import { IsEnum, IsOptional } from 'class-validator';
import { FilterScope } from '@prisma/client';

export class GetFiltersQuery {
  @IsOptional()
  @IsEnum(FilterScope)
  scope?: FilterScope;
}
