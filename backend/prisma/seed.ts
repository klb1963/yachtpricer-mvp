// prisma/seed.ts
import { seedLegacyOwners } from './seed/legacyOwners';
import { seedRbacUsers } from './seed/rbacUsers';

async function main() {
  console.log('🌱 Seeding database…');
  await seedLegacyOwners();
  await seedRbacUsers();
  console.log('✅ Seeding done!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});