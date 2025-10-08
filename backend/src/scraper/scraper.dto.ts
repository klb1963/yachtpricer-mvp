import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsArray,
  ArrayUnique,
} from 'class-validator';
import { JobStatus } from '@prisma/client';

export type ScrapeSourceLiteral = 'INNERDB' | 'NAUSYS';
export const ScrapeSource = {
  INNERDB: 'INNERDB',
  NAUSYS: 'NAUSYS',
} as const;

/**
 * Запуск скрапинга + фильтры отбора конкурентных яхт
 */
export class StartScrapeDto {
  /** Источник данных (опционально) */
  @IsOptional()
  @IsEnum(ScrapeSource)
  source?: ScrapeSourceLiteral;

  /** ID сохранённого Competitor Filter (активный) */
  @IsOptional()
  @IsString()
  filterId?: string;

  /** ID нашей яхты (для сравнения) */
  @IsOptional()
  @IsString()
  yachtId?: string;

  /** Любая дата внутри недели (ISO); позже нормализуем к началу недели */
  @IsOptional()
  @IsISO8601({ strict: true })
  weekStart?: string;

  /** Произвольная география/марина (если используется) */
  @IsOptional()
  @IsString()
  location?: string;

  /** Тип (monohull, catamaran и т.п.) */
  @IsOptional()
  @IsString()
  type?: string;

  /** Годы выпуска (min/max) */
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  minYear?: number;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  maxYear?: number;

  /** Длина, метры (min/max) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  minLength?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxLength?: number;

  /** Вместимость/каюты/санузлы (точные значения) */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  people?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  cabins?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  heads?: number;
}

/**
 * Вспомогательные DTO под query-параметры контроллера
 */
export class ScrapeStatusQueryDto {
  @IsString()
  jobId!: string; // если у вас UUID — замените на @IsUUID()
}

export class CompetitorsQueryDto {
  @IsOptional()
  @IsString()
  yachtId?: string;

  /** Неделя начала (ISO), если фронт отправляет именно week */
  @IsOptional()
  @IsISO8601({ strict: true })
  week?: string;
}

export class AggregateDto {
  @IsString()
  yachtId!: string;

  /** Любая дата внутри недели */
  @IsISO8601()
  week!: string;

  @IsOptional()
  @IsEnum(ScrapeSource)
  source?: ScrapeSourceLiteral; // по умолчанию INNERDB (маппим на BOATAROUND внутри сервиса)
}

/**
 * Dry-run для /scrape/test: все поля опциональны.
 * Добавлены “мульти-фильтры” (страны/категории/билдеры/модели/регионы) + диапазоны.
 * Бэкенд может частично игнорировать те поля, которых нет в схеме.
 */
export class TestFiltersDto {
  /** Страны по ISO-2 (например, HR/GR/TR) */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  countryCodes?: string[];

  /** Категории (ID из внутреннего каталога) */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  categoryIds?: number[];

  /** Производители (ID из внутреннего каталога) */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  builderIds?: number[];
}

/** Новый тип ответа для /scrape/start */
export type StartResponseDto = {
  jobId: string;
  status: JobStatus;
  kept: number; // сколько кандидатов прошло фильтры
  reasons: string[]; // агрегированные причины отбраковки
};
