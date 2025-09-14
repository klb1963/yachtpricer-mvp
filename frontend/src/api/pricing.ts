// frontend/src/api/pricing.ts

// ✅ Общий axios-клиент. Через него автоматически подставляется Authorization: Bearer …
import { api } from '@/api';

export type DecisionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export type RowPerms = {
  canSubmit: boolean;
  canApproveOrReject: boolean;
};

export type PricingRow = {
  yachtId: string;
  name: string;
  basePrice: number;
  snapshot: null | {
    top1Price: number;
    top3Avg: number;
    currency: string;
    sampleSize: number;
    collectedAt: string;
  };
  decision: null | {
    discountPct: number | null;
    finalPrice: number | null;
    status: DecisionStatus;
  };
  mlReco: number | null;
  finalPrice: number | null;
  perms?: RowPerms; // ← добавили perms
};

// ✅ типы "сырых" данных от бэка (числа могут прийти строками)
type RawSnapshot = {
  top1Price: number | string | null | undefined;
  top3Avg: number | string | null | undefined;
  currency: string;
  sampleSize?: number | undefined;
  collectedAt: string;
};

type RawDecision = {
  discountPct: number | string | null | undefined;
  finalPrice: number | string | null | undefined;
  status: DecisionStatus;
};

type RawPricingRow = {
  yachtId: string;
  name: string;
  basePrice: number | string;
  snapshot?: RawSnapshot | null;
  decision?: RawDecision | null;
  mlReco?: number | string | null;
  finalPrice?: number | string | null;
  perms?: {
    canSubmit?: boolean;
    canApproveOrReject?: boolean;
  };
};

// безопасное приведение строковых чисел → number
function num(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

// ✅ нормализация строки
function normalizeRow(r: RawPricingRow): PricingRow {
  return {
    yachtId: r.yachtId,
    name: r.name,
    basePrice: num(r.basePrice) ?? 0,
    snapshot: r.snapshot
      ? {
          top1Price: num(r.snapshot.top1Price) ?? 0,
          top3Avg: num(r.snapshot.top3Avg) ?? 0,
          currency: r.snapshot.currency,
          sampleSize: r.snapshot.sampleSize ?? 0,
          collectedAt: r.snapshot.collectedAt,
        }
      : null,
    decision: r.decision
      ? {
          discountPct: num(r.decision.discountPct),
          finalPrice: num(r.decision.finalPrice),
          status: r.decision.status,
        }
      : null,
    mlReco: num(r.mlReco ?? null),
    finalPrice: num(r.finalPrice ?? null),
    perms: r.perms
      ? {
          canSubmit: !!r.perms.canSubmit,
          canApproveOrReject: !!r.perms.canApproveOrReject,
        }
      : undefined,
  };
}

/* ======================
   Запросы через Axios api
   ====================== */

// Список строк на неделю
export async function fetchRows(weekISO: string): Promise<PricingRow[]> {
  const { data } = await api.get<RawPricingRow[]>('/pricing/rows', { params: { week: weekISO } });
  return Array.isArray(data) ? data.map(normalizeRow) : [];
}

// Создание/обновление решения (скидка/итог)
export async function upsertDecision(params: {
  yachtId: string;
  week: string;
  discountPct?: number | null;
  finalPrice?: number | null;
}): Promise<PricingRow> {
  const { data } = await api.post<RawPricingRow>('/pricing/decision', params);
  return normalizeRow(data);
}

// Смена статуса (Submit/Approve/Reject)
export async function changeStatus(params: {
  yachtId: string;
  week: string;
  status: DecisionStatus;
}): Promise<PricingRow> {
  const { data } = await api.post<RawPricingRow>('/pricing/status', params);
  return normalizeRow(data);
}
