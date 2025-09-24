// backend/src/pricing/pricing-utils.ts
import { Prisma } from '@prisma/client';

/** Суббота 00:00 UTC для заданной даты */
export function weekStartUTC(d: Date) {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = x.getUTCDay(); // 0..6 (вск..сб)
  const diff = (day - 6 + 7) % 7; // до субботы
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

// Тайп-guard: это Prisma.Decimal (или совместимый объект с toNumber(): number)
export function isPrismaDecimal(x: unknown): x is Prisma.Decimal {
  return (
    x instanceof Prisma.Decimal ||
    (typeof x === 'object' &&
      x !== null &&
      'toNumber' in x &&
      typeof (x as { toNumber?: unknown }).toNumber === 'function')
  );
}

// type-guard: валидное число
export const isNum = (x: unknown): x is number =>
  typeof x === 'number' && Number.isFinite(x);

// Итоговая цена из базы и скидки (%). На входе — валидные числа.
export const calcFinal = (base: number, discountPct: number): number => {
  const k = 1 - discountPct / 100;
  return Math.round(Math.max(0, base * k));
};

// Скидка (%) из базы и финальной цены. На входе — валидные числа.
export const calcDiscountPct = (base: number, finalPrice: number): number => {
  if (base <= 0) return 0;
  const pct = (1 - finalPrice / base) * 100;
  return Number(pct.toFixed(1));
};

/** Разрешение входной пары (discountPct | finalPrice) в согласованную пару */
export function resolveDiscountPair(
  base: number,
  nextDisc?: number,
  nextFinal?: number,
): { discountPct?: number; finalPrice?: number } {
  if (isNum(nextDisc)) {
    return { discountPct: nextDisc, finalPrice: calcFinal(base, nextDisc) };
  }
  if (isNum(nextFinal)) {
    return {
      finalPrice: nextFinal,
      discountPct: calcDiscountPct(base, nextFinal),
    };
  }
  return {};
}

/** Превышает ли фактическая скидка лимит яхты */
export function exceedsMaxDiscount(
  maxLimit: number | null | undefined,
  effectiveDiscount: number | undefined,
): boolean {
  return (
    maxLimit != null &&
    effectiveDiscount != null &&
    effectiveDiscount > maxLimit
  );
}
