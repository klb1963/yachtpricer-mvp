// backend/src/filters/dto/competitor-filters.dto.ts

import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { FilterScope } from '@prisma/client';

// Приводим вход к массиву строк. Возвращаем [] если явно пришёл пустой массив,
// но если поля не было вообще — оставляем undefined (значит "не трогать это поле").
function toStringArrayKeepEmpty(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  const arr = Array.isArray(v) ? v : v == null || v === '' ? [] : [v];
  return arr
    .map((x) => (typeof x === 'string' ? x.trim() : String(x)))
    .filter((x) => x.length > 0);
}

// То же самое, но приводим элементы к числу (для Int[] связей).
function toIntArrayKeepEmpty(v: unknown): number[] | undefined {
  if (v === undefined) return undefined;
  const arr = Array.isArray(v) ? v : v == null || v === '' ? [] : [v];
  const nums = arr.map((x) => (typeof x === 'number' ? x : Number(x)));
  return nums.filter((n) => Number.isInteger(n));
}

// Мягко приводим к числу или оставляем undefined.
function toNumberOrUndef(v: unknown): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Это DTO, которое реально шлёт фронт через saveCompetitorFilters()
// и которое мы используем в PATCH /filters/competitors и POST /filters/competitors/test
export class CompetitorFiltersBody {
  // scope: "USER" | "ORG"
  @IsOptional()
  @IsString()
  scope?: FilterScope;

  // Гео
  // UUID стран (Country.id[])
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => toStringArrayKeepEmpty(value))
  countryIds?: string[];

  // Region.id[]
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Transform(({ value }) => toIntArrayKeepEmpty(value))
  regionIds?: number[];

  // Location.id[] (UUID)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => toStringArrayKeepEmpty(value))
  locationIds?: string[];

  // Категории / билдеры / модели яхт
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Transform(({ value }) => toIntArrayKeepEmpty(value))
  categoryIds?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Transform(({ value }) => toIntArrayKeepEmpty(value))
  builderIds?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Transform(({ value }) => toIntArrayKeepEmpty(value))
  modelIds?: number[];

  // Диапазоны / допуски
  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  lenFtMinus?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  lenFtPlus?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  yearMinus?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  yearPlus?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  peopleMinus?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  peoplePlus?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  cabinsMinus?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  cabinsPlus?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  headsMin?: number;
}
