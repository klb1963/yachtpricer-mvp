// prisma/seed/legacyOwners.ts

import { PrismaClient, Prisma, YachtType, WeekSlotStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedLegacyOwners() {
  console.log('👤 Seeding legacy owners & yachts…');

  // Owners (upsert по email)
  const owner1 = await prisma.owner.upsert({
    where: { email: 'john.doe@example.com' },
    update: { name: 'John Doe', phone: '+123456789' },
    create: { name: 'John Doe', email: 'john.doe@example.com', phone: '+123456789' },
  });

  const owner2 = await prisma.owner.upsert({
    where: { email: 'jane.smith@example.com' },
    update: { name: 'Jane Smith', phone: '+987654321' },
    create: { name: 'Jane Smith', email: 'jane.smith@example.com', phone: '+987654321' },
  });

  // Yachts (upsert по nausysId, чтобы был уникальный ключ)
  const yacht1 = await prisma.yacht.upsert({
    where: { nausysId: 'LEG-1' },
    update: {
      name: 'Sun Odyssey 45',
      manufacturer: 'Jeanneau',
      model: 'Sun Odyssey',
      type: YachtType.monohull,
      length: 13.72,
      builtYear: 2015,
      cabins: 4,
      heads: 2,
      basePrice: new Prisma.Decimal(3500),
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
    create: {
      nausysId: 'LEG-1',
      name: 'Sun Odyssey 45',
      manufacturer: 'Jeanneau',
      model: 'Sun Odyssey',
      type: YachtType.monohull,
      length: 13.72,
      builtYear: 2015,
      cabins: 4,
      heads: 2,
      basePrice: new Prisma.Decimal(3500),
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

  const yacht2 = await prisma.yacht.upsert({
    where: { nausysId: 'LEG-2' },
    update: {
      name: 'Bavaria Cruiser 41',
      manufacturer: 'Bavaria',
      model: 'Cruiser',
      type: YachtType.monohull,
      length: 12.35,
      builtYear: 2018,
      cabins: 3,
      heads: 2,
      basePrice: new Prisma.Decimal(3200),
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
    create: {
      nausysId: 'LEG-2',
      name: 'Bavaria Cruiser 41',
      manufacturer: 'Bavaria',
      model: 'Cruiser',
      type: YachtType.monohull,
      length: 12.35,
      builtYear: 2018,
      cabins: 3,
      heads: 2,
      basePrice: new Prisma.Decimal(3200),
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

  const yacht3 = await prisma.yacht.upsert({
    where: { nausysId: 'LEG-3' },
    update: {
      name: 'Lagoon 42',
      manufacturer: 'Lagoon',
      model: '42',
      type: YachtType.catamaran,
      length: 12.8,
      builtYear: 2020,
      cabins: 4,
      heads: 4,
      basePrice: new Prisma.Decimal(5200),
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
    create: {
      nausysId: 'LEG-3',
      name: 'Lagoon 42',
      manufacturer: 'Lagoon',
      model: '42',
      type: YachtType.catamaran,
      length: 12.8,
      builtYear: 2020,
      cabins: 4,
      heads: 4,
      basePrice: new Prisma.Decimal(5200),
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

  // WeekSlots за август 2025 — upsert по композитному уникальному
  const yachts = [yacht1, yacht2, yacht3];
  const augustStart = new Date('2025-08-02'); // суббота
  for (const y of yachts) {
    for (let i = 0; i < 4; i++) {
      const startDate = new Date(augustStart);
      startDate.setDate(startDate.getDate() + i * 7);

      await prisma.weekSlot.upsert({
        where: { yachtId_startDate: { yachtId: y.id, startDate } },
        update: { status: WeekSlotStatus.OPEN, currentPrice: y.basePrice, currentDiscount: new Prisma.Decimal(0) },
        create: {
          yachtId: y.id,
          startDate,
          status: WeekSlotStatus.OPEN,
          currentPrice: y.basePrice,
          currentDiscount: new Prisma.Decimal(0),
        },
      });
    }
  }

  console.log('✅ Legacy owners & yachts seeded');
}