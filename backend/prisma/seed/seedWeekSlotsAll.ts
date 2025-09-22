/* prisma/seed/seedWeekSlotsAll.ts */
/* eslint-disable no-console */

import { PrismaClient, Prisma, WeekSlotStatus } from '@prisma/client';

const prisma = new PrismaClient();

/** UTC date helper */
function dUTC(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d));
}

/** Вернёт все субботы в диапазоне [from .. to] включительно (UTC) */
function saturdaysBetween(from: Date, to: Date): Date[] {
  const res: Date[] = [];
  const cur = new Date(from.getTime());
  // найти первую субботу
  const wd = cur.getUTCDay();            // 0..6 (0 — вс, 6 — сб)
  const add = (6 - wd + 7) % 7;
  cur.setUTCDate(cur.getUTCDate() + add);

  while (cur <= to) {
    res.push(new Date(cur.getTime()));
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return res;
}

async function main() {
  console.log('🧩 Seeding week slots for ALL yachts (Sep–Oct 2025)…');

  // Диапазон: 2025-09-01..2025-10-31 → все субботы (обычно 9),
  // но ты просил 8 — просто возьмём первые 8 из найденных.
  const from = dUTC(2025, 8, 1);  // Sep 1, 2025 (month: 0-Jan)
  const to   = dUTC(2025, 9, 31); // Oct 31, 2025
  const saturdays = saturdaysBetween(from, to).slice(0, 8);

  console.log('Weeks:', saturdays.map(s => s.toISOString().slice(0,10)).join(', '));

  const yachts = await prisma.yacht.findMany({
    select: { id: true, basePrice: true, name: true },
    orderBy: { createdAt: 'asc' }
  });

  if (yachts.length === 0) {
    console.log('⚠️  No yachts found. Nothing to seed.');
    return;
  }

  let upserts = 0;
  for (const y of yachts) {
    const price = y.basePrice ?? new Prisma.Decimal(0);
    for (const weekStart of saturdays) {
      await prisma.weekSlot.upsert({
        where: { yachtId_startDate: { yachtId: y.id, startDate: weekStart } },
        update: {
          status: WeekSlotStatus.OPEN,
          currentPrice: price,
          currentDiscount: new Prisma.Decimal(0),
        },
        create: {
          yachtId: y.id,
          startDate: weekStart,
          status: WeekSlotStatus.OPEN,
          currentPrice: price,
          currentDiscount: new Prisma.Decimal(0),
        },
      });
      upserts++;
    }
  }

  console.log(`✅ Done. Yachts: ${yachts.length}, weeks per yacht: ${saturdays.length}, total upserts: ${upserts}`);
}

main()
  .catch(e => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());