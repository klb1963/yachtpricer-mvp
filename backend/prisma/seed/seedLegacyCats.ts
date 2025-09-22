/* prisma/seed/seedLegacyCats.ts */
import { PrismaClient, Prisma, YachtType } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedLegacyCats42() {
  console.log('⛵ Seeding catamarans ~42ft…');

  const data = [
    {
      nausysId: 'CAT-1',
      name: 'Lagoon 42',
      manufacturer: 'Lagoon',
      model: '42',
      type: YachtType.catamaran,
      length: 42.0,
      builtYear: 2019,
      cabins: 4,
      heads: 4,
      basePrice: new Prisma.Decimal('5200.00'),
      location: 'Dubrovnik, Komolac, ACI Marina Dubrovnik',
      fleet: 'EN',
      charterCompany: 'Dubrovnik Sailing',
      imageUrl: '/images/yachts/catamaran.jpg',
    },
    {
      nausysId: 'CAT-2',
      name: 'Bali 4.2',
      manufacturer: 'Bali',
      model: '4.2',
      type: YachtType.catamaran,
      length: 42.2,
      builtYear: 2021,
      cabins: 4,
      heads: 4,
      basePrice: new Prisma.Decimal('5500.00'),
      location: 'Marina Kastela', // ← 1 катамаран в Kastela
      fleet: 'EN',
      charterCompany: 'Adriatic Charter',
      imageUrl: '/images/yachts/catamaran.jpg',
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

  console.log('✅ Cats seeded');
}

async function main() {
  await seedLegacyCats42();
}
main().finally(() => prisma.$disconnect());