// frontend/src/api/pricingDecisions.ts
import { api } from '@/api';

/** Статусы решения по цене */
export type DecisionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export type PricingDecision = {
  id: string;
  yachtId: string;
  weekStart: string;            // ISO string
  basePrice: string;
  top1?: string | null;
  top3?: string | null;
  mlReco?: string | null;
  discountPct?: string | null;
  finalPrice?: string | null;
  status: DecisionStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
};

export type Perms = {
  canView: boolean;
  canSubmit: boolean;
  canApproveOrReject: boolean;
};

/** Получить решение вместе с правами текущего актёра */
export async function getDecisionWithPerms(
  decisionId: string,
  actorId: string
): Promise<{ decision: PricingDecision; perms: Perms }> {
  const { data } = await api.get<{ decision: PricingDecision; perms: Perms }>(
    `/pricing-decisions/${decisionId}/with-perms`,
    { params: { actorId } }
  );
  return data;
}

/** Перевести из DRAFT/REJECTED → SUBMITTED */
export async function submitDecision(
  decisionId: string,
  actorId: string
): Promise<PricingDecision> {
  const { data } = await api.post<PricingDecision>(
    `/pricing-decisions/${decisionId}/submit`,
    { actorId }
  );
  return data;
}

/** Перевести из SUBMITTED → APPROVED */
export async function approveDecision(
  decisionId: string,
  actorId: string
): Promise<PricingDecision> {
  const { data } = await api.post<PricingDecision>(
    `/pricing-decisions/${decisionId}/approve`,
    { actorId }
  );
  return data;
}

/** Перевести из SUBMITTED → REJECTED (обязателен comment) */
export async function rejectDecision(
  decisionId: string,
  actorId: string,
  comment: string
): Promise<PricingDecision> {
  const { data } = await api.post<PricingDecision>(
    `/pricing-decisions/${decisionId}/reject`,
    { actorId, comment }
  );
  return data;
}
