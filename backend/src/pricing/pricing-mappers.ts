// backend/src/pricing/pricing-mappers.ts
import { Decimal } from '@prisma/client/runtime/library';
import { toNum } from '../common/decimal';

export function mapActualFields(slot?: {
  currentPrice: Decimal | null;
  currentDiscount: Decimal | null;
  priceSource: string | null;
  priceFetchedAt: Date | null;
}) {
  const actualPrice = slot?.currentPrice ? toNum(slot.currentPrice) : null;
  const actualDiscountPct = slot?.currentDiscount
    ? toNum(slot.currentDiscount)
    : null;
  const priceSource = slot?.priceSource ? String(slot.priceSource) : null;
  const priceFetchedAt = slot?.priceFetchedAt
    ? slot.priceFetchedAt.toISOString()
    : null;
  return { actualPrice, actualDiscountPct, priceSource, priceFetchedAt };
}
