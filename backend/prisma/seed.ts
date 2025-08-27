// backend/prisma/seed.ts

/* eslint-disable no-console */
/* eslint-disable no-process-exit */
/* eslint-disable @typescript-eslint/no-floating-promises */

import { PrismaClient, WeekSlotStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Зафиксированные ID, которые использует фронт/тесты
const YACHT_ID_A = '2db34fda-7bc0-4fb0-96e8-19270320a50f';
const YACHT_ID_B = 'acafec2e-7228-4bdb-8aff-9312eac2f3fa';
const YACHT_ID_LEGACY = '1'; // допустим, фронт где-то шлёт "1"

async function main() {
  console.log('👤 Seeding owners…');
  const owner1 = await prisma.owner.upsert({
    where: { email: 'john.doe@example.com' },
    update: {},
    create: { name: 'John Doe', email: 'john.doe@example.com', phone: '+123456789' },
  });

  const owner2 = await prisma.owner.upsert({
    where: { email: 'jane.smith@example.com' },
    update: {},
    create: { name: 'Jane Smith', email: 'jane.smith@example.com', phone: '+987654321' },
  });

  console.log('⛵ Seeding yachts…');

  const yachtA = await prisma.yacht.upsert({
    where: { id: YACHT_ID_A },
    update: {},
    create: {
      id: YACHT_ID_A,
      name: 'Bavaria Cruiser 41',
      manufacturer: 'Bavaria',
      model: 'Cruiser',
      type: 'Sailing yacht',
      length: 12.35,       // метры
      builtYear: 2018,
      cabins: 3,
      heads: 2,
      basePrice: 3200,
      location: 'Marina Split',
      fleet: 'EN',
      charterCompany: 'Split Charter',
      ownerId: owner2.id,
      ownerName: owner2.name,
      currentExtraServices: [
        { name: 'Outboard engine', price: 80 },
        { name: 'WiFi', price: 50 },
      ],
      imageUrl: '/images/yachts/monohull.jpg',
    },
  });

  const yachtB = await prisma.yacht.upsert({
    where: { id: YACHT_ID_B },
    update: {},
    create: {
      id: YACHT_ID_B,
      name: 'Lagoon 42',
      manufacturer: 'Lagoon',
      model: '42',
      type: 'Catamaran',
      length: 12.8,
      builtYear: 2020,
      cabins: 4,
      heads: 4,
      basePrice: 5200,
      location: 'Marina Dubrovnik',
      fleet: 'EN',
      charterCompany: 'Dubrovnik Sailing',
      ownerId: owner1.id,
      ownerName: owner1.name,
      currentExtraServices: [
        { name: 'Skipper', price: 180 },
        { name: 'Final cleaning', price: 150 },
      ],
      imageUrl: '/images/yachts/catamaran.jpg',
    },
  });

  const yachtLegacy = await prisma.yacht.upsert({
    where: { id: YACHT_ID_LEGACY },
    update: {},
    create: {
      id: YACHT_ID_LEGACY,
      name: 'Sun Odyssey 45',
      manufacturer: 'Jeanneau',
      model: 'Sun Odyssey',
      type: 'Sailing yacht',
      length: 13.72,
      builtYear: 2015,
      cabins: 4,
      heads: 2,
      basePrice: 3500,
      location: 'Marina Kastela',
      fleet: 'EN',
      charterCompany: 'Adriatic Charter',
      ownerId: owner1.id,
      ownerName: owner1.name,
      currentExtraServices: [
        { name: 'Transit log', price: 150 },
        { name: 'Final cleaning', price: 100 },
      ],
      imageUrl: '/images/yachts/monohull.jpg',
    },
  });

  console.log('📅 Seeding week slots for August 2025…');
  const yachts = [yachtA, yachtB, yachtLegacy];

  // Первая суббота августа 2025 (UTC 00:00)
  const augustStart = new Date('2025-08-02T00:00:00.000Z');

  for (const yacht of yachts) {
    for (let i = 0; i < 4; i++) {
      const startDate = new Date(augustStart);
      startDate.setUTCDate(startDate.getUTCDate() + i * 7);

      // Требуется @@unique([yachtId, startDate]) в модели WeekSlot
      await prisma.weekSlot.upsert({
        where: { yachtId_startDate: { yachtId: yacht.id, startDate } },
        update: {
          status: WeekSlotStatus.OPEN,
          currentPrice: yacht.basePrice,
          currentDiscount: 0,
        },
        create: {
          yachtId: yacht.id,
          startDate,
          status: WeekSlotStatus.OPEN,
          currentPrice: yacht.basePrice,
          currentDiscount: 0,
        },
      });
    }
  }

  console.log('✅ Seed complete!');
  console.log('IDs:', {
    yachtA: yachtA.id,
    yachtB: yachtB.id,
    yachtLegacy: yachtLegacy.id,
  });
}

(async function seedWrapper() {
  try {
    await main();
  } catch (e) {
    console.error(e);
    process.exitCode = 1; 
  } finally {
    await prisma.$disconnect();
  }
})();