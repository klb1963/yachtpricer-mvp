// prisma/seed/seedYachts.monohulls.ts
import { PrismaClient, Prisma, YachtType, WeekSlotStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedYachtsMonohulls45ft() {
  console.log('⛵ Seeding monohulls ~45ft…');

  // owners (гарантируем наличие)
  const john = await prisma.owner.upsert({
    where: { email: 'john.doe@example.com' },
    update: { name: 'John Doe', phone: '+123456789' },
    create: { name: 'John Doe', email: 'john.doe@example.com', phone: '+123456789' },
  });
  const jane = await prisma.owner.upsert({
    where: { email: 'jane.smith@example.com' },
    update: { name: 'Jane Smith', phone: '+987654321' },
    create: { name: 'Jane Smith', email: 'jane.smith@example.com', phone: '+987654321' },
  });

  // 4 моногула ~45ft (как в твоей таблице)
  const monohulls = [
    {
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
      charterCompany: 'Adriatic Charter',
      owner: jane,
      imageUrl: '/images/yachts/monohull.jpg',
    },
    {
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
      charterCompany: 'Adriatic Charter',
      owner: john,
      imageUrl: '/images/yachts/monohull.jpg',
    },
    {
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
      charterCompany: '—',
      owner: john,
      imageUrl: '/images/yachts/monohull.jpg',
    },
    {
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
      charterCompany: '—',
      owner: john,
      imageUrl: '/images/yachts/monohull.jpg',
    },
  ] as const;

  const augustStart = new Date('2025-08-02'); // суббота

  for (const m of monohulls) {
    const y = await prisma.yacht.upsert({
      where: { nausysId: m.nausysId },
      update: {
        name: m.name,
        manufacturer: m.manufacturer,
        model: m.model,
        type: m.type,
        length: m.length,
        builtYear: m.builtYear,
        cabins: m.cabins,
        heads: m.heads,
        basePrice: m.basePrice,
        location: m.location,
        charterCompany: m.charterCompany,
        ownerId: m.owner.id,
        ownerName: m.owner.name,
        imageUrl: m.imageUrl,
      },
      create: {
        nausysId: m.nausysId,
        name: m.name,
        manufacturer: m.manufacturer,
        model: m.model,
        type: m.type,
        length: m.length,
        builtYear: m.builtYear,
        cabins: m.cabins,
        heads: m.heads,
        basePrice: m.basePrice,
        location: m.location,
        charterCompany: m.charterCompany,
        ownerId: m.owner.id,
        ownerName: m.owner.name,
        imageUrl: m.imageUrl,
      },
    });

    for (let i = 0; i < 4; i++) {
      const startDate = new Date(augustStart);
      startDate.setDate(startDate.getDate() + i * 7);
      await prisma.weekSlot.upsert({
        where: { yachtId_startDate: { yachtId: y.id, startDate } },
        update: {
          status: WeekSlotStatus.OPEN,
          currentPrice: y.basePrice,
          currentDiscount: new Prisma.Decimal(0),
        },
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

  console.log('✅ Monohulls seeded');
}