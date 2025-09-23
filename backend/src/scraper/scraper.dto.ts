import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { JobStatus } from '@prisma/client';

export type ScrapeSourceLiteral = 'BOATAROUND' | 'SEARADAR' | 'INNERDB';
export const ScrapeSource = {
  BOATAROUND: 'BOATAROUND',
  SEARADAR: 'SEARADAR',
  INNERDB: 'INNERDB',
} as const;

// Запуск скрапинга + фильтры отбора конкурентных яхт
export class StartScrapeDto {
  /** Источник данных (опционально) */
  @IsOptional()
  @IsEnum(ScrapeSource)
  source?: ScrapeSourceLiteral;

  /** Фильтры под отбор и сравнение конкурентов */
  @IsOptional()
  @IsString()
  yachtId?: string;

  /** Начало недели (ISO-строка), позже преобразуем в Date */
  @IsOptional()
  @IsISO8601({ strict: true })
  weekStart?: string;

  @IsOptional()
  @IsString()
  location?: string;

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

  /** Новые поля для сравнения: вместимость/каюты/санузлы (точные значения) */
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

// Вспомогательные DTO под query-параметры контроллера
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

  @IsISO8601()
  week!: string; // любая дата внутри недели

  @IsOptional()
  @IsEnum(ScrapeSource)
  source?: ScrapeSourceLiteral; // по умолчанию BOATAROUND
}

// Новый тип ответа для /scrape/start
export type StartResponseDto = {
  jobId: string;
  status: JobStatus;
  kept: number; // сколько кандидатов прошло фильтры
  reasons: string[]; // топ-причины отбраковки (агрегированные)
};
