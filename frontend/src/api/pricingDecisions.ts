// frontend/src/api/pricingDecisions.ts

// 🔧 общий API-базис
const API = import.meta.env.VITE_API_URL ?? '/api';

export type DecisionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export type PricingDecision = {
  id: string;
  yachtId: string;
  weekStart: string; // ISO string
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

// 👉 получить решение вместе с правами текущего актёра
export async function getDecisionWithPerms(decisionId: string, actorId: string) {
  const r = await fetch(
    `${API}/pricing-decisions/${decisionId}/with-perms?actorId=${encodeURIComponent(actorId)}`
  );
  if (!r.ok) throw new Error(`Failed to load decision: ${r.status}`);
  return (await r.json()) as { decision: PricingDecision; perms: Perms };
}

// 👉 перевести из DRAFT/REJECTED → SUBMITTED
export async function submitDecision(decisionId: string, actorId: string) {
  const r = await fetch(`${API}/pricing-decisions/${decisionId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorId }),
  });
  if (!r.ok) throw new Error(`Submit failed: ${r.status}`);
  return (await r.json()) as PricingDecision;
}

// 👉 перевести из SUBMITTED → APPROVED
export async function approveDecision(decisionId: string, actorId: string) {
  const r = await fetch(`${API}/pricing-decisions/${decisionId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorId }),
  });
  if (!r.ok) throw new Error(`Approve failed: ${r.status}`);
  return (await r.json()) as PricingDecision;
}

// 👉 перевести из SUBMITTED → REJECTED (обязателен comment)
export async function rejectDecision(decisionId: string, actorId: string, comment: string) {
  const r = await fetch(`${API}/pricing-decisions/${decisionId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorId, comment }),
  });
  if (!r.ok) throw new Error(`Reject failed: ${r.status}`);
  return (await r.json()) as PricingDecision;
}