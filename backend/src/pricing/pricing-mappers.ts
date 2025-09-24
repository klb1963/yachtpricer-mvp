// backend/src/pricing/pricing-mappers.ts
import { Prisma, CompetitorSnapshot, PricingDecision } from '@prisma/client';
import { toNum } from '../common/decimal';

// Узкий тип для weekSlot, который мы выбираем в запросе findMany(select: {...})
export type WeekSlotMini = {
  yachtId: string;
  currentPrice: Prisma.Decimal;
  currentDiscount: Prisma.Decimal;
  priceSource: string | null;
  priceFetchedAt: Date | null;
};

// Последний аудит по decision
export type AuditMini = { comment: string | null; createdAt: Date };

// ✨ Actual price/discount + источник
export function mapActualFields(slot?: WeekSlotMini) {
  return {
    actualPrice: toNum(slot?.currentPrice),
    actualDiscountPct: toNum(slot?.currentDiscount),
    priceSource: slot?.priceSource ?? null,
    priceFetchedAt: slot?.priceFetchedAt
      ? slot.priceFetchedAt.toISOString()
      : null,
  } as const;
}

// ✨ Снимок конкурентов → плоский объект (числа + ISO)
export function mapSnapshot(s?: CompetitorSnapshot | null) {
  if (!s) return null;
  return {
    top1Price: toNum(s.top1Price),
    top3Avg: toNum(s.top3Avg),
    currency: s.currency,
    sampleSize: s.sampleSize,
    collectedAt: s.collectedAt.toISOString(),
  };
}

// ✨ Черновик/решение → плоский объект (числа)
export function mapDecision(d?: PricingDecision | null) {
  if (!d) return null;
  return {
    discountPct: toNum(d.discountPct),
    finalPrice: toNum(d.finalPrice),
    status: d.status,
  };
}

// Вспомогательная сборка Map-индексов по yachtId
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
