// prisma/seed/rbacUsers.ts
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedRbacUsers() {
  console.log('🛡 Seeding RBAC organization & users…');

  // Организация
  const org = await prisma.organization.upsert({
    where: { slug: 'aquatoria' },
    update: {},
    create: {
      name: 'Aquatoria Group',
      slug: 'aquatoria',
      contactEmail: 'info@aquatoria-group.com',
      websiteUrl: 'https://aquatoria-group.com',
    },
  });

  // Пользователи
  const USERS = {
    admin:   { email: 'sailorleon@gmail.com',        name: 'Admin',         role: Role.ADMIN },
    fm:      { email: 'k_l_b_1963@hotmail.com',      name: 'Fleet Manager', role: Role.FLEET_MANAGER },
    manager: { email: 'lida.kleimann@gmail.com',     name: 'Manager One',   role: Role.MANAGER },
    owner:   { email: 'leonid.kleimann@outlook.com', name: 'Owner Leonid',  role: Role.OWNER },
  } as const;

  await Promise.all(
    Object.values(USERS).map(u =>
      prisma.user.upsert({
        where: { email: u.email },
        update: { name: u.name, role: u.role, orgId: org.id },
        create: { email: u.email, name: u.name, role: u.role, orgId: org.id },
      })
    )
  );

  console.log('✅ RBAC org & users seeded');
}
