// frontend/src/api/pricing.ts

import { api } from '../api';

// — типы, которые ждёт страница —
export type DecisionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export type RowPerms = {
  canEditDraft: boolean;
  canSubmit: boolean;
  canApproveOrReject: boolean;
};

export type PricingRow = {
  yachtId: string;
  name: string;
  basePrice: number;

  snapshot: null | {
    top1Price: number | null;
    top3Avg: number | null;
    currency: string | null;
    sampleSize: number | null;
    collectedAt: string | null; // ISO
  };

  decision: null | {
    discountPct: number | null;
    finalPrice: number | null;
    status: DecisionStatus;
  };

  mlReco: number | null;
  finalPrice: number | null;

  perms?: RowPerms;

  // новое:
  lastComment?: string | null;
  lastActionAt?: string | null; // ISO
};

// — “сырой” ответ бэка (подстроен так, чтобы принять разные варианты) —
type RawPricingRow = {
  yachtId: string;
  name: string;
  basePrice: number | string;

  snapshot?: null | {
    top1Price?: number | string | null;
    top3Avg?: number | string | null;
    currency?: string | null;
    sampleSize?: number | null;
    collectedAt?: string | null;
  };

  decision?: null | {
    discountPct?: number | string | null;
    finalPrice?: number | string | null;
    status?: DecisionStatus | string | null;
  };

  mlReco?: number | string | null;
  finalPrice?: number | string | null;

  perms?: RowPerms;

  lastComment?: string | null;
  lastActionAt?: string | null;
};

// — helpers —
const toNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : null;
};

function normalizeRow(raw: RawPricingRow): PricingRow {
  const snap = raw.snapshot ?? null;
  const dec = raw.decision ?? null;

  return {
    yachtId: raw.yachtId,
    name: raw.name,
    basePrice: toNum(raw.basePrice) ?? 0,

    snapshot: snap
      ? {
          top1Price: toNum(snap.top1Price),
          top3Avg: toNum(snap.top3Avg),
          currency: snap.currency ?? null,
          sampleSize: snap.sampleSize ?? null,
          collectedAt: snap.collectedAt ?? null,
        }
      : null,

    decision: dec
      ? {
          discountPct: toNum(dec.discountPct),
          finalPrice: toNum(dec.finalPrice),
          status:
            (dec.status as DecisionStatus) ??
            'DRAFT', // дефолт безопасный
        }
      : null,

    mlReco: toNum(raw.mlReco),
    finalPrice: toNum(raw.finalPrice),

    perms: raw.perms,

    lastComment: raw.lastComment ?? null,
    lastActionAt: raw.lastActionAt ?? null,
  };
}

// --- local helpers (copy of page helpers) ---
const _calcFinal = (base: number, discountPct: number | null): number | null => {
  if (discountPct == null || !Number.isFinite(discountPct)) return null;
  const k = 1 - discountPct / 100;
  if (k < 0) return 0;
  return Math.round(base * k);
};

const _calcDiscountPct = (base: number, finalPrice: number | null): number | null => {
  if (finalPrice == null || !Number.isFinite(finalPrice) || base <= 0) return null;
  const pct = (1 - finalPrice / base) * 100;
  return Number(pct.toFixed(1));
};

// возвращаем согласованную пару значений (если введено только одно)
export function pairFromRow(r: PricingRow): { discountPct: number | null; finalPrice: number | null } {
  const draftDisc = r.decision?.discountPct ?? null;
  const draftFinal = r.decision?.finalPrice ?? null;

  if (draftDisc != null && Number.isFinite(draftDisc)) {
    return { discountPct: draftDisc, finalPrice: _calcFinal(r.basePrice, draftDisc) };
  }
  if (draftFinal != null && Number.isFinite(draftFinal)) {
    return { discountPct: _calcDiscountPct(r.basePrice, draftFinal), finalPrice: draftFinal };
  }
  return { discountPct: null, finalPrice: null };
}

// — API —
export async function fetchRows(weekISO: string): Promise<PricingRow[]> {
  const { data } = await api.get<RawPricingRow[]>('/pricing/rows', {
    params: { week: weekISO },
  });
  return Array.isArray(data) ? data.map(normalizeRow) : [];
}

export async function upsertDecision(params: {
  yachtId: string;
  week: string;
  discountPct?: number | null;
  finalPrice?: number | null;
}): Promise<PricingRow> {
  const { data } = await api.post<RawPricingRow>('/pricing/upsert', params);
  return normalizeRow(data);
}

export async function changeStatus(params: {
  yachtId: string;
  week: string;
  status: DecisionStatus;
  comment?: string;
  discountPct?: number | null;
  finalPrice?: number | null;
}): Promise<PricingRow> {
  const { data } = await api.post<RawPricingRow>('/pricing/status', params);
  return normalizeRow(data);
}