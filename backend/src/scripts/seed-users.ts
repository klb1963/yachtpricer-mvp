// backend/src/scripts/seed-users.ts
import { PrismaClient, $Enums } from '@prisma/client';

const prisma = new PrismaClient();

// Подгони под свой slug и имя организации
const ORG = { slug: 'yachtpricer', name: 'YachtPricer' } as const;

// СЮДА впиши нужных пользователей
const USERS: Array<{ email: string; name?: string | null; role: $Enums.Role }> =
  [
    { email: 'sailorleon@gmail.com', name: 'Admin Leonid', role: 'ADMIN' },
    {
      email: 'k_l_b_1963@hotmail.com',
      name: 'Fleet Manager',
      role: 'FLEET_MANAGER',
    },
    { email: 'lida.kleinmann@gmail.com', name: 'Manager One', role: 'MANAGER' },
    // добавляй/меняй как нужно
  ];

async function main() {
  // ensure org exists
  const org = await prisma.organization.upsert({
    where: { slug: ORG.slug },
    update: {},
    create: { slug: ORG.slug, name: ORG.name },
  });

  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name ?? null,
        role: u.role,
        orgId: org.id,
      },
      create: {
        email: u.email,
        name: u.name ?? null,
        role: u.role,
        org: { connect: { id: org.id } },
      },
    });
    console.log('Upserted:', user.email, '->', user.role);
  }
}

main().finally(() => prisma.$disconnect());
