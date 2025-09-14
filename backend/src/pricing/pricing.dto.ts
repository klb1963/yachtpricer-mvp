// /yachtpricer-mvp/backend/src/pricing/pricing.dto.ts

import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { DecisionStatus } from '@prisma/client';

export class PricingRowsQueryDto {
  /** Любая дата внутри нужной недели (ISO). */
  @IsISO8601()
  week!: string;
}

export class UpsertDecisionDto {
  @IsString()
  yachtId!: string;

  @IsISO8601()
  week!: string;

  /** % скидки, если задаём через скидку */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct?: number;

  /** Итоговая цена, если задаём напрямую */
  @IsOptional()
  @IsNumber()
  finalPrice?: number;
}

export class ChangeStatusDto {
  @IsString()
  yachtId!: string;

  @IsISO8601()
  week!: string;

  @IsEnum(DecisionStatus)
  status!: DecisionStatus; // SUBMITTED | APPROVED | REJECTED
  comment?: string;
}
