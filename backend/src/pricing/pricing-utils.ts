// backend/src/pricing/pricing-utils.ts

import { Prisma } from '@prisma/client';
import { UnprocessableEntityException } from '@nestjs/common';

// "YYYY-MM-DD" -> Date(UTC 00:00) | null
function parseIsoDateOnlyToUtc(isoDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
}

/** Суббота 00:00 UTC для заданной даты/строки */
export function weekStartUTC(input: Date | string) {
  const d =
    typeof input === 'string'
      ? (parseIsoDateOnlyToUtc(input) ?? new Date(input))
      : input;

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

/** Разрешение входной пары (discountPct | finalPrice) в согласованную пару
 *  Приоритет всегда у finalPrice (ручной ввод)
 */
export function resolveDiscountPair(
  base: number,
  nextDisc?: number,
  nextFinal?: number,
): { discountPct?: number; finalPrice?: number } {
  // ✅ 1. Если передана финальная цена — она главная
  if (isNum(nextFinal)) {
    return {
      finalPrice: nextFinal,
      discountPct: isNum(base) ? calcDiscountPct(base, nextFinal) : undefined,
    };
  }

  // 2. Иначе считаем финал из скидки
  if (isNum(nextDisc)) {
    return {
      discountPct: nextDisc,
      finalPrice: calcFinal(base, nextDisc),
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

/** Бросает 422, если скидка превышает лимит яхты */
export function ensureWithinMaxDiscount(
  maxLimit: number | null | undefined,
  effectiveDiscount: number | undefined,
) {
  if (exceedsMaxDiscount(maxLimit, effectiveDiscount)) {
    throw new UnprocessableEntityException(
      `Discount exceeds yacht max limit (${maxLimit}%).`,
    );
  }
}

/** Упаковывает числовую пару в Prisma.Decimal-пару (только заданные поля) */
export function asDecimalPair(input: {
  discountPct?: number;
  finalPrice?: number;
}): {
  discountPct?: Prisma.Decimal;
  finalPrice?: Prisma.Decimal;
} {
  const out: { discountPct?: Prisma.Decimal; finalPrice?: Prisma.Decimal } = {};
  if (typeof input.discountPct === 'number') {
    out.discountPct = new Prisma.Decimal(input.discountPct);
  }
  if (typeof input.finalPrice === 'number') {
    out.finalPrice = new Prisma.Decimal(input.finalPrice);
  }
  return out;
}
