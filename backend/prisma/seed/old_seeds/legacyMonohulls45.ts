// prisma/seed/legacyMonohulls45.ts
import { PrismaClient, Prisma, YachtType, WeekSlotStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedLegacyMonohulls45() {
  console.log('⛵ Seeding 45ft monohulls…');

  // те же тестовые владельцы (upsert)
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

  // 2 лодки в Marina Kaštela
  const mono1 = await prisma.yacht.upsert({
    where: { nausysId: 'MON-1' },
    update: {
      name: 'Bavaria Cruiser 46',
      manufacturer: 'Bavaria',
      model: 'Cruiser 46',
      type: YachtType.monohull,
      length: 14.27, // ~46.8 ft
      builtYear: 2019,
      cabins: 4,
      heads: 2,
      basePrice: new Prisma.Decimal(4000),
      location: 'Marina Kastela',
      fleet: 'EN',
      charterCompany: 'Adriatic Charter',
      ownerId: owner2.id,
      ownerName: owner2.name,
      currentExtraServices: [{ name: 'WiFi', price: 50 }],
      imageUrl: '/images/yachts/monohull.jpg',
    },
    create: {
      nausysId: 'MON-1',
      name: 'Bavaria Cruiser 46',
      manufacturer: 'Bavaria',
      model: 'Cruiser 46',
      type: YachtType.monohull,
      length: 14.27,
      builtYear: 2019,
      cabins: 4,
      heads: 2,
      basePrice: new Prisma.Decimal(4000),
      location: 'Marina Kastela',
      fleet: 'EN',
      charterCompany: 'Adriatic Charter',
      ownerId: owner2.id,
      ownerName: owner2.name,
      currentExtraServices: [{ name: 'WiFi', price: 50 }],
      imageUrl: '/images/yachts/monohull.jpg',
    },
  });

  const mono2 = await prisma.yacht.upsert({
    where: { nausysId: 'MON-2' },
    update: {
      name: 'Beneteau Oceanis 46.1',
      manufacturer: 'Beneteau',
      model: 'Oceanis 46.1',
      type: YachtType.monohull,
      length: 14.1, // ~46.1 ft
      builtYear: 2020,
      cabins: 4,
      heads: 2,
      basePrice: new Prisma.Decimal(4200),
      location: 'Marina Kastela',
      fleet: 'EN',
      charterCompany: 'Adriatic Charter',
      ownerId: owner1.id,
      ownerName: owner1.name,
      currentExtraServices: [{ name: 'Final cleaning', price: 120 }],
      imageUrl: '/images/yachts/monohull.jpg',
    },
    create: {
      nausysId: 'MON-2',
      name: 'Beneteau Oceanis 46.1',
      manufacturer: 'Beneteau',
      model: 'Oceanis 46.1',
      type: YachtType.monohull,
      length: 14.1,
      builtYear: 2020,
      cabins: 4,
      heads: 2,
      basePrice: new Prisma.Decimal(4200),
      location: 'Marina Kastela',
      fleet: 'EN',
      charterCompany: 'Adriatic Charter',
      ownerId: owner1.id,
      ownerName: owner1.name,
      currentExtraServices: [{ name: 'Final cleaning', price: 120 }],
      imageUrl: '/images/yachts/monohull.jpg',
    },
  });

  // ещё 2 рядом (для разнообразия)
  const mono3 = await prisma.yacht.upsert({
    where: { nausysId: 'MON-3' },
    update: {
      name: 'Jeanneau Sun Odyssey 449',
      manufacturer: 'Jeanneau',
      model: 'Sun Odyssey 449',
      type: YachtType.monohull,
      length: 13.76,
      builtYear: 2018,
      cabins: 4,
      heads: 2,
      basePrice: new Prisma.Decimal(3600),
      location: 'Marina Split',
      fleet: 'EN',
      charterCompany: 'Split Charter',
      ownerId: owner1.id,
      ownerName: owner1.name,
      currentExtraServices: [{ name: 'Outboard engine', price: 80 }],
      imageUrl: '/images/yachts/monohull.jpg',
    },
    create: {
      nausysId: 'MON-3',
      name: 'Jeanneau Sun Odyssey 449',
      manufacturer: 'Jeanneau',
      model: 'Sun Odyssey 449',
      type: YachtType.monohull,
      length: 13.76,
      builtYear: 2018,
      cabins: 4,
      heads: 2,
      basePrice: new Prisma.Decimal(3600),
      location: 'Marina Split',
      fleet: 'EN',
      charterCompany: 'Split Charter',
      ownerId: owner1.id,
      ownerName: owner1.name,
      currentExtraServices: [{ name: 'Outboard engine', price: 80 }],
      imageUrl: '/images/yachts/monohull.jpg',
    },
  });

  const mono4 = await prisma.yacht.upsert({
    where: { nausysId: 'MON-4' },
    update: {
      name: 'Dufour 470',
      manufacturer: 'Dufour',
      model: '470',
      type: YachtType.monohull,
      length: 14.85,
      builtYear: 2021,
      cabins: 4,
      heads: 2,
      basePrice: new Prisma.Decimal(4800),
      location: 'Trogir',
      fleet: 'EN',
      charterCompany: 'Dalmatia Charter',
      ownerId: owner2.id,
      ownerName: owner2.name,
      currentExtraServices: [{ name: 'WiFi', price: 50 }],
      imageUrl: '/images/yachts/monohull.jpg',
    },
    create: {
      nausysId: 'MON-4',
      name: 'Dufour 470',
      manufacturer: 'Dufour',
      model: '470',
      type: YachtType.monohull,
      length: 14.85,
      builtYear: 2021,
      cabins: 4,
      heads: 2,
      basePrice: new Prisma.Decimal(4800),
      location: 'Trogir',
      fleet: 'EN',
      charterCompany: 'Dalmatia Charter',
      ownerId: owner2.id,
      ownerName: owner2.name,
      currentExtraServices: [{ name: 'WiFi', price: 50 }],
      imageUrl: '/images/yachts/monohull.jpg',
    },
  });

  // WeekSlots (август 2025)
  const yachts = [mono1, mono2, mono3, mono4];
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

  console.log('✅ 45ft monohulls seeded');
}
