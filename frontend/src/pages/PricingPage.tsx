// frontend/src/pages/PricingPage.tsx

import { useEffect, useMemo, useState } from 'react';
import { changeStatus, fetchRows, upsertDecision } from '../api/pricing';
import type { PricingRow } from '../api/pricing';
import { fmtISO, toYMD, nextSaturday, prevSaturday, toSaturdayUTC } from '../utils/week';

function asMoney(n: number | null | undefined) {
  if (n == null) return '—';
  return `€ ${n.toLocaleString('en-EN', { maximumFractionDigits: 0 })}`;
}

function toNumberOrNull(v: string): number | null {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function calcDiscountPct(base: number, final_: number | null | undefined) {
  if (final_ == null || !Number.isFinite(final_) || base <= 0) return null;
  const pct = (1 - final_ / base) * 100;
  return Number(pct.toFixed(1)); // округление до 0.1%
}

function calcFinal(base: number, discountPct: number | null | undefined) {
  if (discountPct == null || !Number.isFinite(discountPct)) return null;
  const k = 1 - discountPct / 100;
  if (k < 0) return 0;
  return Math.round(base * k);
}

type DecisionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export default function PricingPage() {
  const [week, setWeek] = useState(() => fmtISO(toSaturdayUTC(new Date())));
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const weekDate = useMemo(() => new Date(week), [week]);
  const weekLabel = useMemo(() => toYMD(weekDate), [weekDate]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchRows(week);
        setRows(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [week]);

  // --- Локальные onChange (мгновенно меняют state.rows) ---
  function onDraftDiscountChange(yachtId: string, valueStr: string) {
    const discount = toNumberOrNull(valueStr);
    setRows(prev =>
      prev.map(r => {
        if (r.yachtId !== yachtId) return r;
        const newFinal = calcFinal(r.basePrice, discount);
        return {
          ...r,
          finalPrice: newFinal, // чтобы "Calculated:" сразу считался
          decision: {
            status: r.decision?.status ?? 'DRAFT',
            discountPct: discount,
            finalPrice: newFinal,
          },
        };
      })
    );
  }

  function onDraftFinalChange(yachtId: string, valueStr: string) {
    const finalPrice = toNumberOrNull(valueStr);
    setRows(prev =>
      prev.map(r => {
        if (r.yachtId !== yachtId) return r;
        const newDiscount = calcDiscountPct(r.basePrice, finalPrice);
        return {
          ...r,
          finalPrice: finalPrice,
          decision: {
            status: r.decision?.status ?? 'DRAFT',
            discountPct: newDiscount,
            finalPrice: finalPrice,
          },
        };
      })
    );
  }

  // --- Сохранения на бэкенд (по blur/Enter) ---
  async function saveDiscount(yachtId: string) {
    const row = rows.find(x => x.yachtId === yachtId);
    const discountPct = row?.decision?.discountPct ?? null;
    const finalPrice  = row?.decision?.finalPrice ?? null;

    setSavingId(yachtId);
    try {
      await upsertDecision({ yachtId, week, discountPct, finalPrice });
    } finally {
      setSavingId(null);
    }
  }

  async function saveFinal(yachtId: string) {
    const row = rows.find(x => x.yachtId === yachtId);
    const finalPrice  = row?.decision?.finalPrice ?? null;
    const discountPct = row ? calcDiscountPct(row.basePrice, finalPrice) : null;

    setSavingId(yachtId);
    try {
      await upsertDecision({ yachtId, week, finalPrice, discountPct });
    } finally {
      setSavingId(null);
    }
  }

  async function onStatus(yachtId: string, status: DecisionStatus) {
    setSavingId(yachtId);
    try {
      const updated = await changeStatus({ yachtId, week, status });
      setRows(prev => prev.map(r => (r.yachtId === yachtId ? { ...r, ...updated } : r)));
    } finally {
      setSavingId(null);
    }
  }

  function onPickDate(value: string) {
    if (!value) return;
    const picked = new Date(`${value}T00:00:00Z`);
    const sat = toSaturdayUTC(picked);
    setWeek(fmtISO(sat));
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Pricing</h1>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 rounded border"
            onClick={() => setWeek(fmtISO(prevSaturday(weekDate)))}
            disabled={loading}
          >
            ◀ Prev week
          </button>

          <input
            type="date"
            className="px-3 py-2 border rounded bg-white"
            value={weekLabel}
            onChange={(e) => onPickDate(e.target.value)}
            disabled={loading}
          />

          <button
            className="px-3 py-2 rounded border"
            onClick={() => setWeek(fmtISO(nextSaturday(weekDate)))}
            disabled={loading}
          >
            Next week ▶
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-gray-500">No rows for this week.</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="p-3">Yacht</th>
                <th className="p-3">Base</th>
                <th className="p-3">Top1</th>
                <th className="p-3">Avg(Top3)</th>
                <th className="p-3">ML reco</th>
                <th className="p-3">Discount %</th>
                <th className="p-3">Final €</th>
                <th className="p-3">Status</th>
                <th className="p-3 w-48">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.yachtId} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.snapshot?.currency ?? 'EUR'}</div>
                  </td>

                  <td className="p-3">{asMoney(r.basePrice)}</td>
                  <td className="p-3">{asMoney(r.snapshot?.top1Price)}</td>
                  <td className="p-3">{asMoney(r.snapshot?.top3Avg)}</td>
                  <td className="p-3">{asMoney(r.mlReco)}</td>

                  <td className="p-3">
                    <input
                      className="w-20 px-2 py-1 border rounded"
                      type="number"
                      step="0.1"
                      placeholder="—"
                      value={r.decision?.discountPct ?? ''}              // контролируемый
                      onChange={(e) => onDraftDiscountChange(r.yachtId, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                      onBlur={() => saveDiscount(r.yachtId)}             // сохранить на бэкенд
                      disabled={savingId === r.yachtId}
                    />
                  </td>

                  <td className="p-3">
                    <input
                      className="w-28 px-2 py-1 border rounded"
                      type="number"
                      step="1"
                      placeholder="—"
                      value={r.decision?.finalPrice ?? ''}                // контролируемый
                      onChange={(e) => onDraftFinalChange(r.yachtId, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                      onBlur={() => saveFinal(r.yachtId)}                 // сохранить на бэкенд
                      disabled={savingId === r.yachtId}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Calculated: {asMoney(r.finalPrice)}
                    </div>
                  </td>

                  <td className="p-3">
                    <span className="px-2 py-1 text-xs rounded bg-gray-100">
                      {r.decision?.status ?? 'DRAFT'}
                    </span>
                  </td>

                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 rounded text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300"
                        onClick={() => onStatus(r.yachtId, 'SUBMITTED')}
                        disabled={savingId === r.yachtId}
                      >
                        Submit
                      </button>
                      <button
                        className="px-3 py-1 rounded text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-300"
                        onClick={() => onStatus(r.yachtId, 'APPROVED')}
                        disabled={savingId === r.yachtId}
                      >
                        Approve
                      </button>
                      <button
                        className="px-3 py-1 rounded text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-300"
                        onClick={() => onStatus(r.yachtId, 'REJECTED')}
                        disabled={savingId === r.yachtId}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}