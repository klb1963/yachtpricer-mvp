// backend/src/pricing/pricing-mappers.ts

import { Prisma, CompetitorSnapshot, PricingDecision } from '@prisma/client';
import { toNum } from '../common/decimal';
import type { SnapshotDto, DecisionDto } from './pricing-row.dto';

// Узкий тип для weekSlot, который мы выбираем в запросе findMany(select: {...})
export type WeekSlotMini = {
  yachtId: string;
  currentPrice: Prisma.Decimal;
  currentDiscount: Prisma.Decimal;
  priceSource: string | null; // из Prisma-ENUM придёт строка
  priceFetchedAt: Date | null;
};

// Последний аудит по decision (используется в сервисе для last* полей)
export type AuditMini = { comment: string | null; createdAt: Date };

/** Actual price/discount + источник → примитивы для фронта */
export function mapActualFields(slot?: WeekSlotMini) {
  return {
    actualPrice: toNum(slot?.currentPrice),
    actualDiscountPct: toNum(slot?.currentDiscount),
    priceFetchedAt: slot?.priceFetchedAt
      ? slot.priceFetchedAt.toISOString()
      : null,
  } as const;
}

/** Снимок конкурентов → оставляем Decimal/Date под SnapshotDto */
export function mapSnapshot(s?: CompetitorSnapshot | null): SnapshotDto | null {
  if (!s) return null;
  return {
    top1Price: s.top1Price, // Prisma.Decimal
    top3Avg: s.top3Avg, // Prisma.Decimal
    currency: s.currency,
    sampleSize: s.sampleSize,
    collectedAt: s.collectedAt, // Date
  };
}

/** Черновик/решение → оставляем Decimal|null под DecisionDto */
export function mapDecision(d?: PricingDecision | null): DecisionDto | null {
  if (!d) return null;
  return {
    discountPct: d.discountPct, // Prisma.Decimal | null
    finalPrice: d.finalPrice, // Prisma.Decimal | null
    status: d.status,
  };
}

/** Вспомогательная сборка Map-индексов по yachtId */
export function buildMaps(args: {
  snaps: CompetitorSnapshot[];
  decisions: PricingDecision[];
  weekSlots: WeekSlotMini[];
}) {
  const snapByYacht = new Map(args.snaps.map((s) => [s.yachtId, s]));
  const decByYacht = new Map(args.decisions.map((d) => [d.yachtId, d]));
  const slotByYacht = new Map(args.weekSlots.map((w) => [w.yachtId, w]));
  return { snapByYacht, decByYacht, slotByYacht } as const;
}
