// backend/src/filters/dto/update-competitor-filters.dto.ts

import { Type } from 'class-transformer';
import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsIn,
  IsArray,
  IsString,
  ArrayMaxSize,
  ArrayUnique,
} from 'class-validator';
import { Prisma } from '@prisma/client';

export class UpdateCompetitorFiltersDto {
  // Кто сохраняет — организационный или персональный пресет
  // Prisma enum в runtime — просто строки, поэтому используем IsIn со строками
  @IsOptional()
  @IsIn(['USER', 'ORG'])
  scope?: Prisma.CompetitorFiltersCreateInput['scope']; // дефолт ставим в сервисе → 'USER'

  /** Массив локаций (id из таблицы locations) — может быть пустым */
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsOptional()
  locationIds?: string[];

  /** Массив выбранных стран — только для фронта (UX), в БД не пишем */
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsOptional()
  countryCodes?: string[];

  /** Массив регионов (id из таблицы regions) */
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsOptional()
  regionIds?: number[];

  /** Массив категорий (id из таблицы yacht_categories) */
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsOptional()
  categoryIds?: number[];

  /** Массив производителей (id из таблицы yacht_builders) */
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsOptional()
  builderIds?: number[];

  /** Массив моделей (id из таблицы yacht_models) */
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @ArrayUnique()
  @ArrayMaxSize(2000)
  @IsOptional()
  modelIds?: number[];

  // Диапазоны (минусы/плюсы) — опциональны, дефолты применяются в сервисе
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  @IsOptional()
  lenFtMinus?: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(5) @IsOptional() lenFtPlus?: number;

  @Type(() => Number) @IsInt() @Min(0) @Max(5) @IsOptional() yearMinus?: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(5) @IsOptional() yearPlus?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  @IsOptional()
  peopleMinus?: number;
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  @IsOptional()
  peoplePlus?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  @IsOptional()
  cabinsMinus?: number;
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  @IsOptional()
  cabinsPlus?: number;

  // по умолчанию 1 — ставим в сервисе
  @Type(() => Number) @IsInt() @Min(0) @Max(5) @IsOptional() headsMin?: number;
}
