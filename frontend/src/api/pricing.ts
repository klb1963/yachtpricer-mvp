// frontend/src/api/pricing.ts

import { api } from '../api';
import type { ScrapeSource } from '../api';

// — типы, которые ждёт страница —
export type DecisionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

// Совпадает с бэком
export type PriceSourceLiteral =
  | 'INTERNAL'
  | 'NAUSYS'
  | 'BOOKING_MANAGER'
  | 'OTHER';

export type RowPerms = {
  canEditDraft: boolean;
  canSubmit: boolean;
  canApproveOrReject: boolean;
  canReopen: boolean;
};

export type DraftEditedField = 'discount' | 'final';

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

  // ⚠️ decision — это то, что пришло с бэка (истина).
  // __lastEdited — чисто фронтовая мета (НЕ сохраняем на бэкенд).
  decision: null | {
    discountPct: number | null;
    finalPrice: number | null;
    status: DecisionStatus;
    __lastEdited?: DraftEditedField;
  };

  mlReco: number | null;
  finalPrice: number | null;

  perms?: RowPerms;

  // локально на фронте: какое поле редактировали последним (старое поле, оставляем для совместимости)
  draftSource?: DraftEditedField;

  // новое:
  lastComment?: string | null;
  lastActionAt?: string | null; // ISO

  // ─ добавленные колонки (Actuals + Max %) ─
  maxDiscountPercent?: number | null;
  actualPrice?: number | null;
  actualDiscountPercent?: number | null;
  fetchedAt?: string | null; // ISO
  priceSource?: PriceSourceLiteral | null;
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

  // ─ новые поля (стандартизированы на бэке) ─
  maxDiscountPercent?: number | string | null;
  actualPrice?: number | string | null;
  actualDiscountPercent?: number | string | null;
  fetchedAt?: string | null;
  priceSource?: PriceSourceLiteral | null;
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
          status: ((dec.status as DecisionStatus) ?? 'DRAFT') as DecisionStatus,
        }
      : null,

    mlReco: toNum(raw.mlReco),
    finalPrice: toNum(raw.finalPrice),

    perms: raw.perms,

    lastComment: raw.lastComment ?? null,
    lastActionAt: raw.lastActionAt ?? null,

    maxDiscountPercent: toNum(raw.maxDiscountPercent),
    actualPrice: toNum(raw.actualPrice),
    actualDiscountPercent: toNum(raw.actualDiscountPercent),
    fetchedAt: raw.fetchedAt ?? null,
    priceSource: raw.priceSource ?? null,
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

// ─────────────────────────────────────────────────────────────
// DISPLAY-логика пары (НЕ ДЛЯ SUBMIT!)
// Спека: "введённая цена не меняется никогда", % — справка.
// Поэтому: если есть finalPrice — он главный, discount считаем подсказкой.
// ─────────────────────────────────────────────────────────────
export function pairFromRow(
  r: PricingRow,
): { discountPct: number | null; finalPrice: number | null } {
  const disc = r.decision?.discountPct ?? null;
  const final = r.decision?.finalPrice ?? null;

  const hasFinal = final != null && Number.isFinite(final);
  const hasDisc = disc != null && Number.isFinite(disc);

  // display-логика: если есть введённая цена — показываем её,
  // а % считаем справочно
  if (hasFinal) {
    return {
      finalPrice: final as number,
      discountPct: _calcDiscountPct(r.basePrice, final as number),
    };
  }

  // иначе — если есть скидка, показываем её и считаем цену
  if (hasDisc) {
    return {
      discountPct: disc as number,
      finalPrice: _calcFinal(r.basePrice, disc as number),
    };
  }

  return { discountPct: null, finalPrice: null };
}

// ─────────────────────────────────────────────────────────────
// SUBMIT-пейлоад: отправляем только source field
// (нужно на странице, но держим рядом с pairFromRow как часть спеки)
// ─────────────────────────────────────────────────────────────
export function buildSubmitPayload(row: PricingRow): { discountPct?: number; finalPrice?: number } {
  const last = row.decision?.__lastEdited ?? row.draftSource;

  const final = row.decision?.finalPrice;
  const disc = row.decision?.discountPct;

  const hasFinal = final != null && Number.isFinite(final);
  const hasDisc = disc != null && Number.isFinite(disc);

  if (last === 'final' && hasFinal) return { finalPrice: final as number };
  if (last === 'discount' && hasDisc) return { discountPct: disc as number };

  // fallback: приоритет у цены
  if (hasFinal) return { finalPrice: final as number };
  if (hasDisc) return { discountPct: disc as number };
  return {};
}

// — API —
export async function fetchRows(
  weekISO: string,
  source?: ScrapeSource,
): Promise<PricingRow[]> {
  const { data } = await api.get<RawPricingRow[]>('/pricing/rows', {
    params: { week: weekISO, source },
  });
  return Array.isArray(data) ? data.map(normalizeRow) : [];
}

export async function upsertDecision(params: {
  yachtId: string;
  week: string;
  source?: ScrapeSource;
  // ✅ по новой спеке допускаем отправку только одного поля
  discountPct?: number | null;
  finalPrice?: number | null;
}): Promise<PricingRow> {
  const { data } = await api.post<RawPricingRow>('/pricing/decision', params);
  return normalizeRow(data);
}

export async function changeStatus(params: {
  yachtId: string;
  week: string;
  status: DecisionStatus;
  source?: ScrapeSource;
  comment?: string;
  // ✅ по новой спеке на SUBMITTED будем слать только одно поле (на странице)
  discountPct?: number | null;
  finalPrice?: number | null;
}): Promise<PricingRow> {
  const { data } = await api.post<RawPricingRow>('/pricing/status', params);
  return normalizeRow(data);
}