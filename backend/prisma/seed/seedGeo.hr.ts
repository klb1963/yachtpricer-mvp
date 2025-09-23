// prisma/seed/seedGeo.hr.ts
import { PrismaClient, LocationSource } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌍 Seeding geo (HR + locations + aliases)…');

  // 1) Страны: нужна только HR для наших тестов
  await prisma.country.upsert({
    where: { code2: 'HR' },
    update: { name: 'Croatia', code: 'HR' },
    create: { code2: 'HR', name: 'Croatia', code: 'HR' },
  });

  // 2) Локации NauSYS (минимум для тестов)
  const LOCS = [
    { externalId: '54',      name: 'Marina Kastela',                             lat: 43.54548, lon: 16.40480 },
    { externalId: '57',      name: 'Dubrovnik, Komolac, ACI Marina Dubrovnik',   lat: 42.66970, lon: 18.12461 },
    { externalId: '1016367', name: 'Trogir',                                      lat: 43.51566, lon: 16.25112 },
  ] as const;

  for (const L of LOCS) {
    await prisma.location.upsert({
      // В схеме есть @@unique([source, externalId]) → алиас where: { source_externalId: { ... } }
      where: { source_externalId: { source: LocationSource.NAUSYS, externalId: L.externalId } },
      update: { name: L.name, countryCode: 'HR', lat: L.lat, lon: L.lon },
      create: {
        id: `nausys:${L.externalId}`, // стабильный id, чтобы не зависеть от DEFAULT
        source: LocationSource.NAUSYS,
        externalId: L.externalId,
        name: L.name,
        countryCode: 'HR',
        lat: L.lat,
        lon: L.lon,
      },
    });
  }

  // 3) Пара алиасов для каждой локации (минимально)
  const locByExt = Object.fromEntries(
    await Promise.all(LOCS.map(async (L) => {
      const row = await prisma.location.findUniqueOrThrow({
        where: { source_externalId: { source: LocationSource.NAUSYS, externalId: L.externalId } },
        select: { id: true },
      });
      return [L.externalId, row.id] as const;
    }))
  );

  const aliases: { locationId: string; alias: string }[] = [
    { locationId: locByExt['54'],      alias: 'Kastela' },
    { locationId: locByExt['54'],      alias: 'Marina Kaštela' },
    { locationId: locByExt['57'],      alias: 'ACI Marina Dubrovnik' },
    { locationId: locByExt['57'],      alias: 'Komolac' },
    { locationId: locByExt['1016367'], alias: 'SCT Marina Trogir' },
    { locationId: locByExt['1016367'], alias: 'Trogir Marina' },
  ];

  // createMany c skipDuplicates — если уникальный индекс есть, дубликаты пропустит
  await prisma.locationAlias.createMany({
    data: aliases,
    skipDuplicates: true,
  });

  console.log('✅ Geo seeding done.');
}

main()
  .catch((e) => {
    console.error('❌ Geo seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });