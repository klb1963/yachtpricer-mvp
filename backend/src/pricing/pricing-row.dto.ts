// backend/src/pricing/pricing-row.dto.ts
import { Prisma, DecisionStatus } from '@prisma/client';

/** Кусок «снимка конкурентов» в табличке */
export type SnapshotDto = {
  top1Price: Prisma.Decimal;
  top3Avg: Prisma.Decimal;
  currency: string;
  sampleSize: number;
  collectedAt: Date;
};

/** Кусок «черновика/решения» в табличке */
export type DecisionDto = {
  discountPct: Prisma.Decimal | null;
  finalPrice: Prisma.Decimal | null;
  status: DecisionStatus;
};

/** Права на действия над строкой */
export type RowPermsDto = {
  canEditDraft: boolean;
  canSubmit: boolean;
  canApproveOrReject: boolean;
  canReopen: boolean;
};

/** Основная строка таблички на /pricing/rows */
export type PricingRowDto = {
  yachtId: string;
  name: string;
  modelName?: string | null;

  basePrice: Prisma.Decimal;
  snapshot: SnapshotDto | null;
  decision: DecisionDto | null;

  /** «Actual price» за неделю — уже как примитив (number) */
  actualPrice: number | null;

  /** «Actual discount» за неделю — тоже как примитив */
  actualDiscountPercent: number | null;
  /** ISO-строка (удобно для фронта) */
  fetchedAt: string | null;

  /** Максимально допустимая скидка для яхты (проецируем Decimal → number) */
  maxDiscountPercent: number | null;

  /** Последний комментарий/время действия из аудита (ISO-строка) */
  lastComment: string | null;
  lastActionAt: string | null;

  /** эвристика/рекомендация (оставляем Decimal для совместимости) */
  mlReco: Prisma.Decimal | null;

  /** финальная цена из решения (оставляем Decimal для совместимости) */
  finalPrice: Prisma.Decimal | null;

  perms: RowPermsDto;
};
