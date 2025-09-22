// /workspace/backend/prisma/seed.t

import { seedCountries } from './seed/seedCountries';
import { seedLocations } from './seed/seedLocations';
import { seedLocationAliases } from './seed/seedLocationAliases';
import { seedRbacUsers } from './seed/rbacUsers';

// сиды лодок
import { seedYachtsMonohulls45ft } from './seed/seedYachts.monohulls';
import { seedYachtsCats42 } from './seed/seedYachts.cats42';

// опциональные связки/воркфлоу
import { seedRbacDemoLinks } from './seed/rbacDemoLinks';

async function main() {
  console.log('🌱 Seeding database…');

  await seedCountries();
  await seedLocations();
  await seedLocationAliases();

  await seedRbacUsers();            // ← только орг и пользователи

  await seedYachtsMonohulls45ft();  // ← сами лодки
  await seedYachtsCats42();

  await seedRbacDemoLinks();        // ← привязки/решения (если лодки есть)

  console.log('✅ Seeding done!');
}

main().catch((e) => { console.error(e); process.exit(1); });