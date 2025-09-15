// frontend/src/pages/PricingPage.tsx

import { useEffect, useMemo, useState, useCallback } from 'react';
import { changeStatus, fetchRows, upsertDecision } from '../api/pricing';
import type { PricingRow, DecisionStatus } from '../api/pricing';
import { toYMD, nextSaturday, prevSaturday, toSaturdayUTC } from '../utils/week';
import ConfirmActionModal from '@/components/ConfirmActionModal';
import axios from 'axios';

// ─ helpers ─
function asMoney(n: number | null | undefined) {
  if (n == null) return '—';
  return `€ ${n.toLocaleString('en-EN', { maximumFractionDigits: 0 })}`;
}
function fmtWhen(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  // локально-короткий формат: DD.MM HH:mm
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function toNumberOrNull(v: string): number | null {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function calcDiscountPct(base: number, final_: number | null | undefined) {
  if (final_ == null || !Number.isFinite(final_) || base <= 0) return null;
  const pct = (1 - (final_ as number) / base) * 100;
  return Number(pct.toFixed(1));
}
function calcFinal(base: number, discountPct: number | null | undefined) {
  if (discountPct == null || !Number.isFinite(discountPct)) return null;
  const k = 1 - (discountPct as number) / 100;
  if (k < 0) return 0;
  return Math.round(base * k);
}


export default function PricingPage() {
  // ────────────────────────────────────────────────────────────
  // 1) Неделя всегда в формате YYYY-MM-DD (plain date)
  // ────────────────────────────────────────────────────────────
  const [week, setWeek] = useState(() => toYMD(toSaturdayUTC(new Date())));
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [error, setError] = useState<string | null>(null);

  // модалка подтверждения со сбором комментария
  const [dialog, setDialog] = useState<{
    open: boolean;
    yachtId: string | null;
    status: DecisionStatus | null;
  }>({ open: false, yachtId: null, status: null });
  const [submitting, setSubmitting] = useState(false);

  const weekDate = useMemo(() => new Date(`${week}T00:00:00Z`), [week]);
  const weekLabel = useMemo(() => toYMD(weekDate), [weekDate]);

  // ─ загрузка ─
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRows(week);
        setRows(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load pricing rows';
        setError(msg);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [week]);

  // ─ локальный драфт ─
  const onDraftDiscountChange = useCallback((yachtId: string, valueStr: string) => {
    const discount = toNumberOrNull(valueStr);
    setRows(prev =>
      prev.map(r => {
        if (r.yachtId !== yachtId) return r;
        const newFinal = calcFinal(r.basePrice, discount);
        return {
          ...r,
          finalPrice: newFinal,
          decision: {
            status: r.decision?.status ?? 'DRAFT',
            discountPct: discount,
            finalPrice: newFinal,
          },
        };
      }),
    );
  }, []);

  const onDraftFinalChange = useCallback((yachtId: string, valueStr: string) => {
    const finalPrice = toNumberOrNull(valueStr);
    setRows(prev =>
      prev.map(r => {
        if (r.yachtId !== yachtId) return r;
        const newDiscount = calcDiscountPct(r.basePrice, finalPrice);
        return {
          ...r,
          finalPrice,
          decision: {
            status: r.decision?.status ?? 'DRAFT',
            discountPct: newDiscount,
            finalPrice,
          },
        };
      }),
    );
  }, []);

  // ─ сохранение на бэкенд ─
  async function onChangeDiscount(yachtId: string) {
    const row = rows.find(x => x.yachtId === yachtId);
    if (!row) return;
    const discountPct = row.decision?.discountPct ?? null;
    const finalPrice = calcFinal(row.basePrice, discountPct);

    setSavingId(yachtId);
    try {
      const updated = await upsertDecision({ yachtId, week, discountPct, finalPrice });
      setRows(prev => prev.map(r => (r.yachtId === yachtId ? { ...r, ...updated } : r)));
    } finally {
      setSavingId(null);
    }
  }

  async function onChangeFinalPrice(yachtId: string) {
    const row = rows.find(x => x.yachtId === yachtId);
    if (!row) return;
    const finalPrice = row.decision?.finalPrice ?? null;
    const discountPct = calcDiscountPct(row.basePrice, finalPrice);
    // если обе стороны null/равны — ничего не отправляем
    const prevFinal = row.decision?.finalPrice ?? null;
    const prevDisc = row.decision?.discountPct ?? null;
    if (prevFinal === finalPrice && prevDisc === discountPct) return;

    setSavingId(yachtId);
    try {
      const updated = await upsertDecision({ yachtId, week, finalPrice, discountPct });
      setRows(prev => prev.map(r => (r.yachtId === yachtId ? { ...r, ...updated } : r)));
    } catch (e: unknown) {
      // 403 для автосейва по blur показывать не обязательно
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status && status !== 403) {
        alert('Не удалось сохранить черновик');
      }
    } finally {
      setSavingId(null);
    }
  }

  // ─ смена статуса через модалку комментария ─
  function openStatusDialog(yachtId: string, status: DecisionStatus) {
    setDialog({ open: true, yachtId, status });
  }
  function closeDialog() {
    setDialog({ open: false, yachtId: null, status: null });
  }

  async function confirmDialog(comment: string) {
    if (!dialog.yachtId || !dialog.status) return;
    setSubmitting(true);
    setSavingId(dialog.yachtId);
    try {
      const updated = await changeStatus({
        yachtId: dialog.yachtId,
        week,
        status: dialog.status,
        comment: comment?.trim() || undefined,
      });
      // Обновляем только то, что пришло из бэка и реально поменялось
      setRows(prev =>
        prev.map(r =>
          r.yachtId === updated.yachtId
            ? {
              ...r,
              decision: updated.decision ?? r.decision,
              finalPrice: updated.finalPrice ?? r.finalPrice,
              perms: updated.perms ?? r.perms,
              // ✨ либо то, что вернул сервер, либо локально введённый comment
              lastComment: updated.lastComment ?? (comment?.trim() || r.lastComment) ?? null,
              lastActionAt: updated.lastActionAt ?? r.lastActionAt ?? null,
            }
            : r
        )
      );
      closeDialog();
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 403) {
        alert('Недостаточно прав');
      } else {
        alert('Не удалось сменить статус');
        // опционально: console.error(e);
      }
    } finally {
      setSubmitting(false);
      setSavingId(null);
    }
  }

  function dialogTitle() {
    const s = dialog.status;
    if (s === 'SUBMITTED') return 'Submit for approval';
    if (s === 'APPROVED') return 'Approve decision';
    if (s === 'REJECTED') return 'Reject decision';
    return 'Change status';
  }

  function onPickDate(value: string) {
    if (!value) return;
    const picked = new Date(`${value}T00:00:00Z`);
    const sat = toSaturdayUTC(picked);
    setWeek(toYMD(sat)); // ← единый формат YYYY-MM-DD
  }

  // ────────────────────────────────────────────────────────────
  // 2) renderEditors — обратно внутри компонента и ДО использования
  // ────────────────────────────────────────────────────────────
  function renderEditors(r: PricingRow) {
    const discountValue = r.decision?.discountPct ?? '';
    const finalValue = r.decision?.finalPrice ?? '';
  // можно ли редактировать черновик (RBAC от бэкенда)
    const canEdit = r.perms?.canEditDraft ?? false;
  // общий флаг disable для инпутов
    const isDisabled = (savingId === r.yachtId) || !canEdit;

    return (
      <>
        <input
          className="w-20 px-2 py-1 border rounded"
          type="number"
          step="0.1"
          placeholder="—"
          value={discountValue as number | string}

          onChange={(e) => onDraftDiscountChange(r.yachtId, e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          onBlur={() => { if (canEdit) onChangeDiscount(r.yachtId); }}
          disabled={isDisabled}

        />
        <span className="ml-1 text-gray-600">%</span>
        <div className="h-2" />
        <input
          className="w-28 px-2 py-1 border rounded"
          type="number"
          step="1"
          placeholder="—"
          value={finalValue as number | string}
          onChange={(e) => onDraftFinalChange(r.yachtId, e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          onBlur={() => { if (canEdit) onChangeFinalPrice(r.yachtId); }}
          disabled={isDisabled}
        />
        <span className="ml-1 text-gray-600">€</span>
        <div className="text-xs text-gray-500 mt-1">
          Calculated: {asMoney(r.finalPrice)}
        </div>
      </>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-3xl font-bold">Pricing</h1>

        <div className="flex flex-wrap items-center gap-2">
          {/* Переключатель вида */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${viewMode === 'table'
                  ? 'bg-gray-900 text-white'
                  : '!text-gray-800 hover:bg-gray-100'}`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${viewMode === 'cards'
                  ? 'bg-gray-900 text-white'
                  : '!text-gray-800 hover:bg-gray-100'}`}
              >
                Cards
              </button>
            </div>
          </div>

          <button
            className="px-3 py-2 rounded border"
            onClick={() => setWeek(toYMD(prevSaturday(weekDate)))}
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
            onClick={() => setWeek(toYMD(nextSaturday(weekDate)))}
            disabled={loading}
          >
            Next week ▶
          </button>
        </div>
      </div>

      {error && <div className="text-red-600 mb-3">{error}</div>}

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-gray-500">No rows for this week.</div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="p-3">Yacht</th>
                <th className="p-3">Base</th>
                <th className="p-3">Top1</th>
                <th className="p-3">Avg(Top3)</th>
                <th className="p-3">ML reco</th>
                <th className="p-3">Discount % / Final €</th>
                <th className="p-3">Status</th>
                <th className="p-3 w-[18rem]">Last comment</th>
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
                      <td className="p-3">{renderEditors(r)}</td>

                      {/* Status */}
                      <td className="p-3">
                        <span className="px-2 py-1 text-xs rounded bg-gray-100">
                          {r.decision?.status ?? 'DRAFT'}
                        </span>
                      </td>

                      {/* Last comment – СООТВЕТСТВУЕТ заголовку "Last comment" */}
                      <td className="p-3 align-top">
                        <div className="line-clamp-2 break-words">
                          {r.lastComment ?? '—'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {fmtWhen(r.lastActionAt)}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1 rounded text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300"
                            onClick={() => openStatusDialog(r.yachtId, 'SUBMITTED')}
                            disabled={savingId === r.yachtId || !r.perms?.canSubmit}
                            title={r.perms?.canSubmit ? 'Submit' : 'Недостаточно прав'}
                          >
                            Submit
                          </button>
                          <button
                            className="px-3 py-1 rounded text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-300"
                            onClick={() => openStatusDialog(r.yachtId, 'APPROVED')}
                            disabled={savingId === r.yachtId || !r.perms?.canApproveOrReject}
                            title={r.perms?.canApproveOrReject ? 'Approve' : 'Недостаточно прав'}
                          >
                            Approve
                          </button>
                          <button
                            className="px-3 py-1 rounded text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-300"
                            onClick={() => openStatusDialog(r.yachtId, 'REJECTED')}
                            disabled={savingId === r.yachtId || !r.perms?.canApproveOrReject}
                            title={r.perms?.canApproveOrReject ? 'Reject' : 'Недостаточно прав'}
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
      ) : (
        // Cards
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(r => {
            // права на редактирование в карточках такие же, как и в таблице
            const canEdit = r.perms?.canEditDraft ?? false;
            const isDisabled = (savingId === r.yachtId) || !canEdit;
            return (
              <div key={r.yachtId} className="border rounded-lg p-4 shadow bg-white">
                <h2 className="font-semibold text-lg mb-2">{r.name}</h2>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div className="text-gray-500">Base</div><div>{asMoney(r.basePrice)}</div>
                  <div className="text-gray-500">Top1</div><div>{asMoney(r.snapshot?.top1Price)}</div>
                  <div className="text-gray-500">Avg(Top3)</div><div>{asMoney(r.snapshot?.top3Avg)}</div>
                  <div className="text-gray-500">ML reco</div><div>{asMoney(r.mlReco)}</div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs mb-1">Discount</label>
                  <input
                    className="w-24 px-2 py-1 border rounded"
                    type="number"
                    step="0.1"
                    placeholder="—"
                    value={(r.decision?.discountPct ?? '') as number | string}
                    onChange={(e) => onDraftDiscountChange(r.yachtId, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                    onBlur={() => { if (canEdit) onChangeDiscount(r.yachtId); }}
                    disabled={isDisabled}
                  />
                  <span className="ml-1 text-gray-600">%</span>
                </div>

                <div className="mt-3">
                  <label className="block text-xs mb-1">Final price</label>
                  <input
                    className="w-32 px-2 py-1 border rounded"
                    type="number"
                    step="1"
                    placeholder="—"
                    value={(r.decision?.finalPrice ?? '') as number | string}
                    onChange={(e) => onDraftFinalChange(r.yachtId, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                    onBlur={() => { if (canEdit) onChangeFinalPrice(r.yachtId); }}
                    disabled={isDisabled}
                  />
                  <span className="ml-1 text-gray-600">€</span>
                  <div className="text-xs text-gray-500 mt-1">
                    Calculated: {asMoney(r.finalPrice)}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="px-2 py-1 text-xs rounded bg-gray-100">
                    {r.decision?.status ?? 'DRAFT'}
                  </span>
                  {/* справа кнопки, а комментарий покажем ниже */}
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1 rounded text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300"
                      onClick={() => openStatusDialog(r.yachtId, 'SUBMITTED')}
                      disabled={savingId === r.yachtId || !r.perms?.canSubmit}
                      title={r.perms?.canSubmit ? 'Submit' : 'Недостаточно прав'}
                    >
                      Submit
                    </button>
                    <button
                      className="px-3 py-1 rounded text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-300"
                      onClick={() => openStatusDialog(r.yachtId, 'APPROVED')}
                      disabled={savingId === r.yachtId || !r.perms?.canApproveOrReject}
                      title={r.perms?.canApproveOrReject ? 'Approve' : 'Недостаточно прав'}
                    >
                      Approve
                    </button>
                    <button
                      className="px-3 py-1 rounded text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-300"
                      onClick={() => openStatusDialog(r.yachtId, 'REJECTED')}
                      disabled={savingId === r.yachtId || !r.perms?.canApproveOrReject}
                      title={r.perms?.canApproveOrReject ? 'Reject' : 'Недостаточно прав'}
                    >
                      Reject
                    </button>
                  </div>
                 {/* Last comment + time */}
                 <div className="mt-3 border-t pt-3">
                   <div className="text-xs text-gray-500 mb-1">Last comment</div>
                   <div className="text-sm">
                     {r.lastComment ?? '—'}
                   </div>
                   <div className="text-xs text-gray-500 mt-1">
                     {fmtWhen(r.lastActionAt)}
                   </div>
                 </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Диалог комментариев / подтверждения */}
      <ConfirmActionModal
        open={dialog.open}
        title={dialogTitle()}
        confirmLabel={
          dialog.status === 'SUBMITTED'
            ? 'Submit'
            : dialog.status === 'APPROVED'
            ? 'Approve'
            : dialog.status === 'REJECTED'
            ? 'Reject'
            : 'Confirm'
        }
        placeholder={
          dialog.status === 'REJECTED'
            ? 'Why is it rejected? (optional)…'
            : 'Comment (optional)…'
        }
        submitting={submitting}
        onCancel={closeDialog}
        onConfirm={confirmDialog}
      />
    </div>
  );
}