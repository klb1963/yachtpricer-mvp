// prisma/seed/rbacDemoLinks.ts
import { PrismaClient, OwnerMode, DecisionStatus, AuditAction } from '@prisma/client';

const prisma = new PrismaClient();
const d = (iso: string) => new Date(iso);

export async function seedRbacDemoLinks() {
  console.log('🔗 Seeding RBAC demo links (optional)…');

  const org = await prisma.organization.findUnique({ where: { slug: 'aquatoria' } });
  if (!org) {
    console.warn('⚠️ Org "aquatoria" not found — skip demo links.');
    return;
  }

  // пользователи
  const [manager, owner, fm] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'lida.kleimann@gmail.com' } }),
    prisma.user.findUnique({ where: { email: 'leonid.kleimann@outlook.com' } }),
    prisma.user.findUnique({ where: { email: 'k_l_b_1963@hotmail.com' } }),
  ]);

  if (!manager || !owner || !fm) {
    console.warn('⚠️ Some RBAC users missing — skip demo links.');
    return;
  }

  // лодки по nausysId (замени на актуальные)
  const yacht1 = await prisma.yacht.findUnique({ where: { nausysId: 'AQ-1' } });
  const yacht2 = await prisma.yacht.findUnique({ where: { nausysId: 'AQ-2' } });

  if (!yacht1 || !yacht2) {
    console.warn('⚠️ Demo yachts (AQ-1/AQ-2) not found — skip demo links.');
    return;
  }

  // связи
  await prisma.managerYacht.upsert({
    where: { managerId_yachtId: { managerId: manager.id, yachtId: yacht1.id } },
    update: {},
    create: { managerId: manager.id, yachtId: yacht1.id },
  });

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

  // demo decisions + аудит
  const w29 = d('2025-07-19');
  const w30 = d('2025-07-26');
  const w31 = d('2025-08-02');

  const pdDraft = await prisma.pricingDecision.upsert({
    where: { yachtId_weekStart: { yachtId: yacht1.id, weekStart: w29 } },
    update: { status: DecisionStatus.DRAFT },
    create: { yachtId: yacht1.id, weekStart: w29, basePrice: 2500, status: DecisionStatus.DRAFT },
  });

  const pdSubmitted = await prisma.pricingDecision.upsert({
    where: { yachtId_weekStart: { yachtId: yacht1.id, weekStart: w30 } },
    update: { status: DecisionStatus.SUBMITTED },
    create: { yachtId: yacht1.id, weekStart: w30, basePrice: 2550, status: DecisionStatus.SUBMITTED },
  });

  const pdRejected = await prisma.pricingDecision.upsert({
    where: { yachtId_weekStart: { yachtId: yacht2.id, weekStart: w31 } },
    update: { status: DecisionStatus.REJECTED },
    create: { yachtId: yacht2.id, weekStart: w31, basePrice: 3200, status: DecisionStatus.REJECTED },
  });

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

  console.log('✅ RBAC demo links seeded');
}