// prisma/seed/seedYachts.cats42.ts
import { PrismaClient, Prisma, YachtType, WeekSlotStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedYachtsCats42() {
  console.log('⛵ Seeding catamarans 42ft…');

  const john = await prisma.owner.upsert({
    where: { email: 'john.doe@example.com' },
    update: { name: 'John Doe', phone: '+123456789' },
    create: { name: 'John Doe', email: 'john.doe@example.com', phone: '+123456789' },
  });

  // 2 катамарана 42ft
  const cats = [
    {
      nausysId: 'CAT-2',
      name: 'Lagoon 42',
      manufacturer: 'Lagoon',
      model: '42',
      type: 'catamaran' as const,
      length: 12.8,
      builtYear: 2020,
      cabins: 4,
      heads: 4,
      basePrice: new Prisma.Decimal(5200),
      location: 'Trogir',
      charterCompany: '—',
      owner: john,
      imageUrl: '/images/yachts/catamaran.jpg',
    },
    {
      nausysId: 'LEG-5', // Bali 4.2 в Marina Kastela (как на скрине)
      name: 'Bali 4.2',
      manufacturer: 'Bali',
      model: '4.2',
      type: 'catamaran' as const,
      length: 12.85,
      builtYear: 2021,
      cabins: 4,
      heads: 4,
      basePrice: new Prisma.Decimal(5500),
      location: 'Marina Kastela',
      charterCompany: 'Adriatic Charter',
      owner: john,
      imageUrl: '/images/yachts/catamaran.jpg',
    },
  ];

  const augustStart = new Date('2025-08-02'); // суббота

  for (const c of cats) {
    const y = await prisma.yacht.upsert({
      where: { nausysId: c.nausysId },
      update: {
        name: c.name,
        manufacturer: c.manufacturer,
        model: c.model,
        type: c.type,
        length: c.length,
        builtYear: c.builtYear,
        cabins: c.cabins,
        heads: c.heads,
        basePrice: c.basePrice,
        location: c.location,
        charterCompany: c.charterCompany,
        ownerId: c.owner.id,
        ownerName: c.owner.name,
        imageUrl: c.imageUrl,
      },
      create: {
        nausysId: c.nausysId,
        name: c.name,
        manufacturer: c.manufacturer,
        model: c.model,
        type: c.type,
        length: c.length,
        builtYear: c.builtYear,
        cabins: c.cabins,
        heads: c.heads,
        basePrice: c.basePrice,
        location: c.location,
        charterCompany: c.charterCompany,
        ownerId: c.owner.id,
        ownerName: c.owner.name,
        imageUrl: c.imageUrl,
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

  console.log('✅ Catamarans seeded');
}