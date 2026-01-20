// /yachtpricer-mvp/backend/src/pricing/pricing.dto.ts

import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  Min,
  MaxLength,
  IsIn,
} from 'class-validator';
import { DecisionStatus, ScrapeSource } from '@prisma/client';
import { PriceSource } from '@prisma/client';

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

// ─────────────────────────────────────────────────────────────────────────────
// PriceListNode API
// ─────────────────────────────────────────────────────────────────────────────

export class GetPriceListNodesQueryDto {
  @IsString()
  yachtId!: string;
}

export class UpsertPriceListNodeDto {
  @IsString()
  yachtId!: string;

  /** Любая дата внутри недели, будет нормализована через weekStartUTC */
  @IsISO8601()
  weekStart!: string;

  /** Цена прайса на эту неделю */
  @IsNumber()
  @Min(0)
  price!: number;

  /** Валюта (пока разрешим только EUR, чтобы не плодить условности) */
  @IsOptional()
  @IsString()
  @IsIn(['EUR'])
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class DeletePriceListNodeDto {
  @IsString()
  yachtId!: string;

  @IsISO8601()
  weekStart!: string;
}
