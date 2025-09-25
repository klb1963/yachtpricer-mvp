// backend/src/common/decimal.ts

import { Prisma } from '@prisma/client';

/** Унифицированная конвертация Prisma.Decimal → number|null */
export function toNum(x: Prisma.Decimal | null | undefined): number | null {
  return x == null ? null : x.toNumber();
}

/** Унифицированная конвертация number|null → Prisma.Decimal|null */
export function toDecimal(x: number | null | undefined): Prisma.Decimal | null {
  return x == null ? null : new Prisma.Decimal(x);
}
