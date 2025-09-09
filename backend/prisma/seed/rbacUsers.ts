// prisma/seed/rbacUsers.ts
import { PrismaClient, Prisma, Role, OwnerMode, DecisionStatus, AuditAction } from '@prisma/client';

const prisma = new PrismaClient();
const d = (iso: string) => new Date(iso);

export async function seedRbacUsers() {
  console.log('🛡 Seeding RBAC users, links & decisions…');

  // Организация Aquatoria
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

  // Пользователи (твои адреса)
  const USERS = {
    admin:   { email: 'sailorleon@gmail.com',        name: 'Admin',         role: Role.ADMIN },
    fm:      { email: 'k_l_b_1963@hotmail.com',      name: 'Fleet Manager', role: Role.FLEET_MANAGER },
    manager: { email: 'lida.kleimann@gmail.com',     name: 'Manager One',   role: Role.MANAGER },
    owner:   { email: 'leonid.kleimann@outlook.com', name: 'Owner Leonid',  role: Role.OWNER },
  } as const;

  const userEntries = await Promise.all(
    Object.values(USERS).map(u =>
      prisma.user.upsert({
        where: { email: u.email },
        update: { name: u.name, role: u.role, orgId: org.id },
        create: { email: u.email, name: u.name, role: u.role, orgId: org.id },
      })
    )
  );

  const byEmail = Object.fromEntries(userEntries.map(u => [u.email, u]));
  const admin   = byEmail[USERS.admin.email];
  const fm      = byEmail[USERS.fm.email];
  const manager = byEmail[USERS.manager.email];
  const owner   = byEmail[USERS.owner.email];

  // Яхты для RBAC-демо (используем AQ-1/AQ-2, создадим если нет)
  const yacht1 = await prisma.yacht.upsert({
    where: { nausysId: 'AQ-1' },
    update: { orgId: org.id },
    create: {
      nausysId: 'AQ-1',
      name: 'Aquatoria One',
      manufacturer: 'Beneteau',
      model: 'Oceanis 46.1',
      type: 'monohull',
      length: 46.1,
      builtYear: 2020,
      cabins: 4,
      heads: 2,
      basePrice: new Prisma.Decimal('2500.00'),
      location: 'Athens',
      fleet: 'Aquatoria',
      charterCompany: 'Aquatoria Group',
      currentExtraServices: {},
      orgId: org.id,
    },
  });

  const yacht2 = await prisma.yacht.upsert({
    where: { nausysId: 'AQ-2' },
    update: { orgId: org.id },
    create: {
      nausysId: 'AQ-2',
      name: 'Aquatoria Two',
      manufacturer: 'Lagoon',
      model: 'Lagoon 42',
      type: 'catamaran',
      length: 42.0,
      builtYear: 2019,
      cabins: 4,
      heads: 4,
      basePrice: new Prisma.Decimal('3200.00'),
      location: 'Athens',
      fleet: 'Aquatoria',
      charterCompany: 'Aquatoria Group',
      currentExtraServices: {},
      orgId: org.id,
    },
  });

  // MANAGER ↔ yacht1
  await prisma.managerYacht.upsert({
    where: { managerId_yachtId: { managerId: manager.id, yachtId: yacht1.id } },
    update: {},
    create: { managerId: manager.id, yachtId: yacht1.id },
  });

  // OWNER ↔ yachts (режимы)
  await prisma.ownerYacht.upsert({
    where: { ownerId_yachtId: { ownerId: owner.id, yachtId: yacht1.id } },
    update: { mode: OwnerMode.ACTIVE, orgId: org.id },
    create: { ownerId: owner.id, yachtId: yacht1.id, orgId: org.id, mode: OwnerMode.ACTIVE },
  });

  await prisma.ownerYacht.upsert({
    where: { ownerId_yachtId: { ownerId: owner.id, yachtId: yacht2.id } },
    update: { mode: OwnerMode.VIEW_ONLY, orgId: org.id },
    create: { ownerId: owner.id, yachtId: yacht2.id, orgId: org.id, mode: OwnerMode.VIEW_ONLY },
  });

  // Decisions для workflow
  const w29 = d('2025-07-19'); // субботы
  const w30 = d('2025-07-26');
  const w31 = d('2025-08-02');

  const pdDraft = await prisma.pricingDecision.upsert({
    where: { yachtId_weekStart: { yachtId: yacht1.id, weekStart: w29 } },
    update: { status: DecisionStatus.DRAFT, basePrice: new Prisma.Decimal('2500.00') },
    create: {
      yachtId: yacht1.id,
      weekStart: w29,
      basePrice: new Prisma.Decimal('2500.00'),
      status: DecisionStatus.DRAFT,
      notes: 'Initial draft',
    },
  });

  const pdSubmitted = await prisma.pricingDecision.upsert({
    where: { yachtId_weekStart: { yachtId: yacht1.id, weekStart: w30 } },
    update: { status: DecisionStatus.SUBMITTED, basePrice: new Prisma.Decimal('2550.00') },
    create: {
      yachtId: yacht1.id,
      weekStart: w30,
      basePrice: new Prisma.Decimal('2550.00'),
      status: DecisionStatus.SUBMITTED,
      notes: 'Submitted by manager',
    },
  });

  const pdRejected = await prisma.pricingDecision.upsert({
    where: { yachtId_weekStart: { yachtId: yacht2.id, weekStart: w31 } },
    update: { status: DecisionStatus.REJECTED, basePrice: new Prisma.Decimal('3200.00') },
    create: {
      yachtId: yacht2.id,
      weekStart: w31,
      basePrice: new Prisma.Decimal('3200.00'),
      status: DecisionStatus.REJECTED,
      notes: 'Rejected previously',
    },
  });

  // Аудит
  await prisma.priceAuditLog.create({
    data: {
      decisionId: pdSubmitted.id,
      action: AuditAction.SUBMIT,
      fromStatus: DecisionStatus.DRAFT,
      toStatus: DecisionStatus.SUBMITTED,
      actorId: manager.id,
      comment: 'Manager submitted decision',
    },
  });

  await prisma.priceAuditLog.create({
    data: {
      decisionId: pdRejected.id,
      action: AuditAction.REJECT,
      fromStatus: DecisionStatus.SUBMITTED,
      toStatus: DecisionStatus.REJECTED,
      actorId: fm.id,
      comment: 'FM rejected due to pricing mismatch',
    },
  });

  console.log('✅ RBAC users & workflow seeded');
}