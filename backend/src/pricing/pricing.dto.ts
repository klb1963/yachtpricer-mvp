// /yachtpricer-mvp/backend/src/pricing/pricing.dto.ts

import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { DecisionStatus, ScrapeSource } from '@prisma/client';

export class PricingRowsQueryDto {
  /** Любая дата внутри нужной недели (ISO). */
  @IsISO8601()
  week!: string;
  /**
   * Источник конкурентных цен (INNERDB / NAUSYS / BOATAROUND).
   * Опционален: если не указан, будет использован дефолт на уровне сервиса/репозитория.
   */
  @IsOptional()
  @IsEnum(ScrapeSource)
  source?: ScrapeSource;
}

export class UpsertDecisionDto {
  @IsString()
  yachtId!: string;

  @IsISO8601()
  week!: string;

  @IsOptional()
  @IsNumber()
  discountPct?: number;

  // итоговая цена — всегда >= 0
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalPrice?: number;
}

export class ChangeStatusDto {
  @IsString()
  yachtId!: string;

  @IsISO8601()
  week!: string;

  @IsEnum(DecisionStatus)
  status!: DecisionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  // скидка может быть отрицательной или положительной
  @IsOptional()
  @IsNumber()
  discountPct?: number;

  // итоговая цена — всегда >= 0
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalPrice?: number;
}
