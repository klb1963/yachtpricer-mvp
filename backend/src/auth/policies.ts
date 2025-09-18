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
  // Только своя организация
  if (!ctx.sameOrg) return false;

  // Редактируем ТОЛЬКО в DRAFT/REJECTED (жёсткий режим — ничего нельзя после SUBMITTED/APPROVED)
  const editableStatus =
    ctxDecision.status === 'DRAFT' || ctxDecision.status === 'REJECTED';
  if (!editableStatus) return false;

  // Аварийный режим: ADMIN может править всегда (в рамках editableStatus)
  if (user.role === 'ADMIN') return true;

  // Менеджер флота тоже может (для оперативной подмены)
  if (user.role === 'FLEET_MANAGER') return true;

  // Обычный менеджер — только если он отвечает за эту лодку
  if (user.role === 'MANAGER' && ctx.isManagerOfYacht) return true;

  // OWNER и прочие — нет
  return false;
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
