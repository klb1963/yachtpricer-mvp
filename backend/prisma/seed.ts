// prisma/seed.ts

async function callSeed(modulePathNoExt: string, candidates: string[]) {
  // Для ESM/ts-node: пробуем с .ts и без — на разных машинах бывает по-разному
  let mod: any;
  try {
    mod = await import(`${modulePathNoExt}.ts`);
  } catch {
    mod = await import(modulePathNoExt);
  }

  const fn =
    candidates.map((n) => mod?.[n]).find(Boolean) ||
    mod?.default;

  if (typeof fn !== 'function') {
    throw new Error(
      `Seed module "${modulePathNoExt}" не экспортирует функцию (${candidates.join(
        ' | ',
      )} | default)`,
    );
  }
  return fn();
}

async function main() {
  // GEO
  // await callSeed('./seed/seedCountries', ['seedCountries']);
  // await callSeed('./seed/seedLocations', ['seedLocations']);
  // await callSeed('./seed/seedLocationAliases', ['seedLocationAliases']);

  // Демо-лодки
  // await callSeed('./seed/seedLegacyMonohulls', ['seedLegacyMonohulls45ft']);
  // await callSeed('./seed/seedLegacyCats', ['seedLegacyCats42']);

  // Недельные слоты (если в файле export default — подхватится; если named — укажи имя)
  // await callSeed('./seed/seedWeekSlotsAll', ['seedWeekSlotsAll']);
}

main()
  .then(() => console.log('✅ Seeding done!'))
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  });