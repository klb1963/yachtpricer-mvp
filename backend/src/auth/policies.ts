// src/auth/policies.ts
import { User, PricingDecision, DecisionStatus } from '@prisma/client';
import { AccessCtx } from './access-ctx.service';

// ↓ добавь
export type PriceLike = Pick<PricingDecision, 'status'>;

export function canView(user: User, ctx: AccessCtx) {
  if (['ADMIN', 'FLEET_MANAGER'].includes(user.role)) return true;
  if (user.role === 'MANAGER') return ctx.isManagerOfYacht;
  if (user.role === 'OWNER' && ctx.isOwnerOfYacht)
    return ctx.ownerMode !== 'HIDDEN';
  return false;
}
export const canSeeAudit = canView;

export function canEditDraft(
  user: User,
  ctxDecision: { status: DecisionStatus },
  ctx: AccessCtx,
): boolean {
  // Должны быть в одной организации (см. AccessCtx.sameOrg)
  if (!ctx.sameOrg) return false;

  // Роль: редактирует только менеджер
  if (user.role !== 'MANAGER') return false;

  // Разрешаем правку только когда решение в DRAFT или REJECTED
  return ctxDecision.status === 'DRAFT' || ctxDecision.status === 'REJECTED';
}

export function canSubmit(user: User, price: PriceLike, ctx: AccessCtx) {
  if (['ADMIN', 'FLEET_MANAGER'].includes(user.role)) return true;
  if (
    user.role === 'MANAGER' &&
    ctx.isManagerOfYacht &&
    ['DRAFT', 'REJECTED'].includes(price.status)
  )
    return true;
  return false;
}

export function canApproveOrReject(
  user: User,
  price: PriceLike,
  ctx: AccessCtx,
) {
  if (['ADMIN', 'FLEET_MANAGER'].includes(user.role)) return true;
  if (
    user.role === 'OWNER' &&
    ctx.isOwnerOfYacht &&
    ctx.ownerMode === 'ACTIVE' &&
    price.status === 'SUBMITTED'
  )
    return true;
  return false;
}
