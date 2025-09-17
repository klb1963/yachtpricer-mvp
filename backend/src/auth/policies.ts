// src/auth/policies.ts

import { User, PricingDecision, DecisionStatus } from '@prisma/client';
import { AccessCtx } from './access-ctx.service';

export type PriceLike = Pick<PricingDecision, 'status'>;

export function canView(user: User, ctx: AccessCtx) {
  if (['ADMIN', 'FLEET_MANAGER'].includes(user.role)) return true;
  if (user.role === 'MANAGER') return ctx.isManagerOfYacht;
  if (user.role === 'OWNER' && ctx.isOwnerOfYacht)
    return ctx.ownerMode !== 'HIDDEN';
  return false;
}
export const canSeeAudit = canView;

/** Редактирование полей черновика (инпуты на UI) */
export function canEditDraft(
  user: User,
  ctxDecision: { status: DecisionStatus },
  ctx: AccessCtx,
): boolean {
  if (!ctx.sameOrg) return false;

  // ОСТАВЛЯЕМ как было: правит только менеджер флота этой лодки
  // (если нужно, чтобы ADMIN тоже мог редактировать поля — раскомментируй строку ниже)
  // if (user.role === 'ADMIN') return ctxDecision.status === 'DRAFT' || ctxDecision.status === 'REJECTED';

  if (user.role !== 'MANAGER') return false;
  return ctxDecision.status === 'DRAFT' || ctxDecision.status === 'REJECTED';
}

/** Submit (доступен в DRAFT/REJECTED) */
export function canSubmit(
  user: User,
  price: PriceLike,
  ctx: AccessCtx,
): boolean {
  if (price.status !== 'DRAFT' && price.status !== 'REJECTED') return false;

  // ADMIN всегда может (жёсткий режим после APPROVED нас не касается здесь)
  if (user.role === 'ADMIN') return true;

  // Fleet Manager — тоже может
  if (user.role === 'FLEET_MANAGER') return true;

  // Менеджер — только если он менеджер этой лодки
  if (user.role === 'MANAGER' && ctx.isManagerOfYacht) return true;

  return false;
}

/** Approve/Reject (доступны только в SUBMITTED) */
export function canApproveOrReject(
  user: User,
  price: PriceLike,
  ctx: AccessCtx,
): boolean {
  if (price.status !== 'SUBMITTED') return false;

  if (user.role === 'ADMIN') return true;
  if (user.role === 'FLEET_MANAGER') return true;

  if (user.role === 'OWNER' && ctx.isOwnerOfYacht && ctx.ownerMode === 'ACTIVE')
    return true;

  return false;
}
