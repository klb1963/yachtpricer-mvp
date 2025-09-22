// prisma/seed/legacyCats42.ts
import { PrismaClient, Prisma, YachtType, WeekSlotStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedLegacyCats42() {
  console.log('⛵ Seeding 42ft catamarans…');

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

  // 1) Bali 4.2 — Marina Kaštela
  const cat1 = await prisma.yacht.upsert({
    where: { nausysId: 'CAT-1' },
    update: {
      name: 'Bali 4.2',
      manufacturer: 'Bali',
      model: '4.2',
      type: YachtType.catamaran,
      length: 12.85,
      builtYear: 2021,
      cabins: 4,
      heads: 4,
      basePrice: new Prisma.Decimal(5500),
      location: 'Marina Kastela',
      fleet: 'EN',
      charterCompany: 'Adriatic Charter',
      ownerId: owner1.id,
      ownerName: owner1.name,
      currentExtraServices: [{ name: 'Skipper', price: 180 }],
      imageUrl: '/images/yachts/catamaran.jpg',
    },
    create: {
      nausysId: 'CAT-1',
      name: 'Bali 4.2',
      manufacturer: 'Bali',
      model: '4.2',
      type: YachtType.catamaran,
      length: 12.85,
      builtYear: 2021,
      cabins: 4,
      heads: 4,
      basePrice: new Prisma.Decimal(5500),
      location: 'Marina Kastela',
      fleet: 'EN',
      charterCompany: 'Adriatic Charter',
      ownerId: owner1.id,
      ownerName: owner1.name,
      currentExtraServices: [{ name: 'Skipper', price: 180 }],
      imageUrl: '/images/yachts/catamaran.jpg',
    },
  });

  // 2) Lagoon 42 — Trogir
  const cat2 = await prisma.yacht.upsert({
    where: { nausysId: 'CAT-2' },
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
      location: 'Trogir',
      fleet: 'EN',
      charterCompany: 'Dalmatia Charter',
      ownerId: owner2.id,
      ownerName: owner2.name,
      currentExtraServices: [{ name: 'Final cleaning', price: 150 }],
      imageUrl: '/images/yachts/catamaran.jpg',
    },
    create: {
      nausysId: 'CAT-2',
      name: 'Lagoon 42',
      manufacturer: 'Lagoon',
      model: '42',
      type: YachtType.catamaran,
      length: 12.8,
      builtYear: 2020,
      cabins: 4,
      heads: 4,
      basePrice: new Prisma.Decimal(5200),
      location: 'Trogir',
      fleet: 'EN',
      charterCompany: 'Dalmatia Charter',
      ownerId: owner2.id,
      ownerName: owner2.name,
      currentExtraServices: [{ name: 'Final cleaning', price: 150 }],
      imageUrl: '/images/yachts/catamaran.jpg',
    },
  });

  const yachts = [cat1, cat2];
  const augustStart = new Date('2025-08-02');
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

  console.log('✅ 42ft catamarans seeded');
}