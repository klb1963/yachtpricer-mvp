// backend/prisma/seed.ts

/* eslint-disable no-console */
/* eslint-disable no-process-exit */
/* eslint-disable @typescript-eslint/no-floating-promises */

import { PrismaClient, WeekSlotStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('👤 Seeding owners…');
  const owner1 = await prisma.owner.create({
    data: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+123456789',
    },
  });

  const owner2 = await prisma.owner.create({
    data: {
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      phone: '+987654321',
    },
  });

  console.log('⛵ Seeding yachts…');
  const yacht1 = await prisma.yacht.create({
    data: {
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
      currentExtraServices: JSON.stringify([
        { name: 'Transit log', price: 150 },
        { name: 'Final cleaning', price: 100 },
      ]),
    },
  });

  const yacht2 = await prisma.yacht.create({
    data: {
      name: 'Bavaria Cruiser 41',
      manufacturer: 'Bavaria',
      model: 'Cruiser',
      type: 'Sailing yacht',
      length: 12.35,
      builtYear: 2018,
      cabins: 3,
      heads: 2,
      basePrice: 3200,
      location: 'Marina Split',
      fleet: 'EN',
      charterCompany: 'Split Charter',
      ownerId: owner2.id,
      ownerName: owner2.name,
      currentExtraServices: JSON.stringify([
        { name: 'Outboard engine', price: 80 },
        { name: 'WiFi', price: 50 },
      ]),
    },
  });

  const yacht3 = await prisma.yacht.create({
    data: {
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
      currentExtraServices: JSON.stringify([
        { name: 'Skipper', price: 180 },
        { name: 'Final cleaning', price: 150 },
      ]),
    },
  });

  console.log('📅 Seeding week slots for August 2025…');
  const yachts = [yacht1, yacht2, yacht3];
  const augustStart = new Date('2025-08-02'); // первая суббота августа

  for (const yacht of yachts) {
    for (let i = 0; i < 4; i++) {
      const startDate = new Date(augustStart);
      startDate.setDate(startDate.getDate() + i * 7);

      await prisma.weekSlot.create({
        data: {
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
}

(async function seedWrapper() {
  try {
    await main();
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
