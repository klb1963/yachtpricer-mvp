// backend/src/filters/dto/update-competitor-filters.dto.ts

import { Type } from 'class-transformer';
import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsEnum,
  IsArray,
  IsString,
  ArrayMaxSize,
  ArrayUnique,
} from 'class-validator';
import { FilterScope } from '@prisma/client';

export class UpdateCompetitorFiltersDto {
  // Кто сохраняет — организационный или персональный пресет
  @IsEnum(FilterScope)
  @IsOptional()
  scope?: FilterScope; // дефолт ставим в сервисе → USER

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

  /** Массив категорий (id из таблицы yacht_categories) */
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsOptional()
  categoryIds?: string[];

  /** Массив производителей (id из таблицы yacht_builders) */
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsOptional()
  builderIds?: string[];

  /** Массив моделей (id из таблицы yacht_models) */
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @ArrayMaxSize(2000)
  @IsOptional()
  modelIds?: string[];

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
