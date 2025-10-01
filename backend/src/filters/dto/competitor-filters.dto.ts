// backend/src/filters/dto/competitor-filters.dto.ts

import { AtLeastOne } from '../../validators/at-least-one.validator';
import { IsArray, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

// утил: приводим к массиву строк, фильтруем пустые
const toStringArray = (v: unknown): string[] | undefined => {
  const arr = Array.isArray(v) ? v : v == null || v === '' ? [] : [v];
  const clean = arr
    .map((x) => (typeof x === 'string' ? x.trim() : String(x)))
    .filter((x) => x.length > 0);
  return clean.length ? clean : undefined;
};

// утил: мягко приводим к числу или убираем
const toNumberOrUndef = (v: unknown): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export class CompetitorFiltersDto {
  // --- IDs для M2M (если присланы — синхронизируем связи) ---
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  locationIds?: string[]; // string PK

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  categoryIds?: Array<string | number>; // int PK (может прийти строкой)

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  builderIds?: Array<string | number>; // int PK

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  modelIds?: Array<string | number>; // int PK

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  regionIds?: Array<string | number>; // int PK

  // --- ОТКЛОНЕНИЯ / SETTINGS ---
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

  @IsOptional()
  scope?: 'USER' | 'ORG';

  // --- ТЕРРИТОРИЯ ---
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toStringArray(value)?.map((s) => s.toUpperCase()))
  countryCodes?: string[]; // ISO-2, временный алиас

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  regions?: string[];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  locations?: string[];

  // --- ТИП/МОДЕЛЬ ---
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  categories?: string[];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  builders?: string[];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  models?: string[];

  // --- ЧИСЛОВЫЕ ДИАПАЗОНЫ ---
  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  lengthMin?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  lengthMax?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  cabinsMin?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  cabinsMax?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  yearMin?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  yearMax?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrUndef(value))
  @IsNumber()
  @Min(0)
  priceMax?: number;
}

// --- ВАЛИДАЦИЯ «хотя бы одно поле заполнено» ---
export class CompetitorFiltersBody extends CompetitorFiltersDto {
  @AtLeastOne([
    'countryCodes',
    'regions',
    'locations',
    'categories',
    'builders',
    'models',
  ])
  private readonly __atLeastOneMarker__!: unknown;
}
