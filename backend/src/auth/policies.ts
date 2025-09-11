// src/auth/policies.ts

import { User, PricingDecision } from '@prisma/client';
import { AccessCtx } from './access-ctx.service';

export function canView(user: User, ctx: AccessCtx) {
  if (['ADMIN','FLEET_MANAGER'].includes(user.role)) return true;
  if (user.role === 'MANAGER') return ctx.isManagerOfYacht;
  if (user.role === 'OWNER' && ctx.isOwnerOfYacht) return ctx.ownerMode !== 'HIDDEN';
  return false;
}
export const canSeeAudit = canView;

export function canEditDraft(user: User, price: PricingDecision, ctx: AccessCtx) {
  if (['ADMIN','FLEET_MANAGER'].includes(user.role)) return true;
  if (user.role === 'MANAGER' && ctx.isManagerOfYacht && price.status === 'DRAFT') return true;
  return false;
}

export function canSubmit(user: User, price: PricingDecision, ctx: AccessCtx) {
  if (['ADMIN','FLEET_MANAGER'].includes(user.role)) return true;
  if (user.role === 'MANAGER' && ctx.isManagerOfYacht && ['DRAFT','REJECTED'].includes(price.status)) return true;
  return false;
}

export function canApproveOrReject(user: User, price: PricingDecision, ctx: AccessCtx) {
  if (['ADMIN','FLEET_MANAGER'].includes(user.role)) return true;
  if (user.role === 'OWNER' && ctx.isOwnerOfYacht && ctx.ownerMode === 'ACTIVE' && price.status === 'SUBMITTED') return true;
  return false;
}