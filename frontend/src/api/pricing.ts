// frontend/src/api/pricing.ts

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
      status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    };
    mlReco: number | null;
    finalPrice: number | null;
  };
  
  const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
  
  // безопасное приведение строковых чисел → number
  function num(x: unknown): number | null {
    if (x === null || x === undefined) return null;
    const n = typeof x === 'number' ? x : Number(x);
    return Number.isFinite(n) ? n : null;
  }
  
  function normalizeRow(r: any): PricingRow {
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
      mlReco: num(r.mlReco),
      finalPrice: num(r.finalPrice),
    };
  }
  
  export async function fetchRows(weekISO: string): Promise<PricingRow[]> {
    const r = await fetch(`${API}/pricing/rows?week=${encodeURIComponent(weekISO)}`);
    if (!r.ok) throw new Error('Failed to load pricing rows');
    const data = await r.json();
    return Array.isArray(data) ? data.map(normalizeRow) : [];
  }
  
  export async function upsertDecision(params: {
    yachtId: string;
    week: string;
    discountPct?: number | null;
    finalPrice?: number | null;
  }) {
    const r = await fetch(`${API}/pricing/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!r.ok) throw new Error('Failed to upsert decision');
    return normalizeRow(await r.json());
  }
  
  export async function changeStatus(params: {
    yachtId: string;
    week: string;
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  }) {
    const r = await fetch(`${API}/pricing/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!r.ok) throw new Error('Failed to change status');
    return normalizeRow(await r.json());
  }