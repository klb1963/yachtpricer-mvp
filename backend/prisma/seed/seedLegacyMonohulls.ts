/* prisma/seed/seedLegacyMonohulls.ts */
import { PrismaClient, Prisma, YachtType } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedLegacyMonohulls45ft() {
  console.log('⛵ Seeding monohulls ~45ft…');

  const data = [
    {
      nausysId: 'MON-1',
      name: 'Aquatoria One',
      manufacturer: 'Beneteau',
      model: 'Oceanis 46.1',
      type: YachtType.monohull,
      length: 46.1,
      builtYear: 2020,
      cabins: 4,
      heads: 4,
      basePrice: new Prisma.Decimal('2500.00'),
      location: 'Marina Kastela',
      fleet: 'Aquatoria',
      charterCompany: 'Aquatoria Group',
      imageUrl: '/images/yachts/monohull.jpg',
    },
    {
      nausysId: 'MON-2',
      name: 'Bavaria Cruiser 41',
      manufacturer: 'Bavaria',
      model: 'Cruiser 41',
      type: YachtType.monohull,
      length: 40.5,
      builtYear: 2018,
      cabins: 3,
      heads: 2,
      basePrice: new Prisma.Decimal('3200.00'),
      location: 'Marina Split',
      fleet: 'EN',
      charterCompany: 'Split Charter',
      imageUrl: '/images/yachts/monohull.jpg',
    },
    {
      nausysId: 'MON-3',
      name: 'Bavaria Cruiser 46',
      manufacturer: 'Bavaria',
      model: 'Cruiser 46',
      type: YachtType.monohull,
      length: 46.0,
      builtYear: 2019,
      cabins: 4,
      heads: 3,
      basePrice: new Prisma.Decimal('4000.00'),
      location: 'Marina Kastela', // ← 2-я яхта в Kastela
      fleet: 'EN',
      charterCompany: 'Adriatic Charter',
      imageUrl: '/images/yachts/monohull.jpg',
    },
    {
      nausysId: 'MON-4',
      name: 'Sun Odyssey 45',
      manufacturer: 'Jeanneau',
      model: 'Sun Odyssey 45',
      type: YachtType.monohull,
      length: 44.1,
      builtYear: 2015,
      cabins: 4,
      heads: 2,
      basePrice: new Prisma.Decimal('3500.00'),
      location: 'Trogir',
      fleet: 'EN',
      charterCompany: 'Adriatic Charter',
      imageUrl: '/images/yachts/monohull.jpg',
    },
  ] as const;

  for (const y of data) {
    await prisma.yacht.upsert({
      where: { nausysId: y.nausysId },
      update: {
        name: y.name,
        manufacturer: y.manufacturer,
        model: y.model,
        type: y.type,
        length: y.length,
        builtYear: y.builtYear,
        cabins: y.cabins,
        heads: y.heads,
        basePrice: y.basePrice,
        location: y.location,
        fleet: y.fleet,
        charterCompany: y.charterCompany,
        imageUrl: y.imageUrl,
      },
      create: { ...y, currentExtraServices: {} },
    });
  }

  console.log('✅ Monohulls seeded');
}

async function main() {
  await seedLegacyMonohulls45ft();
}
main().finally(() => prisma.$disconnect());