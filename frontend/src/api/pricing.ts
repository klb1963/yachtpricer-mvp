// frontend/src/api/pricing.ts

// ✅ Общий axios-клиент. Он уже подставляет Authorization: Bearer …
import { api } from '@/api';

// ────────────────────────────────────────────────────────────
// Типы статуса решений (в синхроне с backend/@prisma/client)
// ────────────────────────────────────────────────────────────
export type DecisionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

// ────────────────────────────────────────────────────────────
// Типы фронта
// ────────────────────────────────────────────────────────────
export type RowPerms = {
  canEditDraft?: boolean;
  canSubmit?: boolean;
  canApproveOrReject?: boolean;
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
  perms?: RowPerms;
  // ✨ новый блок
  lastComment?: string | null;
  lastActionAt?: string | null;
};

// ────────────────────────────────────────────────────────────
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

type RawPerms = {
  canEditDraft?: boolean;
  canSubmit?: boolean;
  canApproveOrReject?: boolean;
};

type RawPricingRow = {
  yachtId: string;
  name?: string; // может не прийти в changeStatus
  basePrice: number | string;
  snapshot?: RawSnapshot | null;

  // Вариант из rows()
  decision?: RawDecision | null;

  // Общие поля
  mlReco?: number | string | null;
  finalPrice?: number | string | null; // может быть и в rows(), и в changeStatus
  perms?: RawPerms | null;

  // ✨ Поля, которые приходят из changeStatus()
  yacht?: { name: string } | null;               // include: { yacht: true }
  status?: DecisionStatus;                        // плоский статус
  discountPct?: number | string | null | undefined;
  // finalPrice уже есть сверху

  // ✨ Мета-поля аудита (могут быть string | Date | null)
  lastComment?: string | null;
  lastActionAt?: string | Date | null;
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function num(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

function normalizeRow(r: RawPricingRow): PricingRow {
  // Есть ли «плоское» решение (как в ответе changeStatus)
  const hasInlineDecision =
    r.status !== undefined ||
    r.discountPct !== undefined ||
    r.finalPrice !== undefined;

  // Имя яхты: либо из rows(), либо из вложенного yacht (changeStatus)
  const name = r.name ?? r.yacht?.name ?? '';

  // Собираем decision из одного из форматов
  const decision = r.decision
    ? {
        discountPct: num(r.decision.discountPct),
        finalPrice: num(r.decision.finalPrice),
        status: r.decision.status,
      }
    : hasInlineDecision
    ? {
        discountPct: num(r.discountPct ?? null),
        finalPrice: num(r.finalPrice ?? null),
        status: (r.status ?? 'DRAFT') as DecisionStatus,
      }
    : null;

  // Приводим lastActionAt к ISO-строке или null
  const lastActionAt =
    r.lastActionAt == null
      ? null
      : typeof r.lastActionAt === 'string'
      ? r.lastActionAt
      : r.lastActionAt.toISOString();

  return {
    yachtId: r.yachtId,
    name,
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
    decision,
    mlReco: num(r.mlReco ?? null),
    // finalPrice может прийти и в rows(), и «плоско» из changeStatus — поле одно и то же
    finalPrice: num(r.finalPrice ?? null),
    perms: r.perms
      ? {
          canEditDraft: !!r.perms.canEditDraft,
          canSubmit: !!r.perms.canSubmit,
          canApproveOrReject: !!r.perms.canApproveOrReject,
        }
      : {},
    lastComment: r.lastComment ?? null,
    lastActionAt,
  };
}

// ────────────────────────────────────────────────────────────
// API
// ────────────────────────────────────────────────────────────
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
}) {
  const { data } = await api.post<RawPricingRow>('/pricing/decision', params);
  return normalizeRow(data);
}

export async function changeStatus(params: {
  yachtId: string;
  week: string;
  status: DecisionStatus;
  comment?: string;
}) {
  const { data } = await api.post<RawPricingRow>('/pricing/status', params);
  return normalizeRow(data);
}