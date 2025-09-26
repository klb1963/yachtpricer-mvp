// frontend/src/pages/PricingPage.tsx

import { useEffect, useMemo, useState, useCallback } from 'react';
import { changeStatus, fetchRows, upsertDecision, pairFromRow } from '../api/pricing';
import type { PricingRow, DecisionStatus } from '../api/pricing';
import { toYMD, nextSaturday, prevSaturday, toSaturdayUTC } from '../utils/week';
import ConfirmActionModal from '@/components/ConfirmActionModal';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

// ─ helpers ─
function asMoney(n: number | null | undefined) {
  if (n == null) return '—';
  return `€ ${n.toLocaleString('en-EN', { maximumFractionDigits: 0 })}`;
}

function asPercent(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n as number)) return '—';
  return `${n}%`;
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
  // i18n
  const { t } = useTranslation('pricing');

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
  const weekISO = useMemo(() => `${week}T00:00:00.000Z`, [week]);

  // ─ загрузка ─
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRows(weekISO);
        if (alive) setRows(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load pricing rows';
        if (alive) {
          setError(msg);
          setRows([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [weekISO]);

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
      const updated = await upsertDecision({ yachtId, week: weekISO, discountPct, finalPrice });
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
      const updated = await upsertDecision({ yachtId, week: weekISO, finalPrice, discountPct });
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
    (document.activeElement as HTMLElement | null)?.blur?.();
    setDialog({ open: true, yachtId, status });
  }
  function closeDialog() {
    setDialog({ open: false, yachtId: null, status: null });
  }

  async function confirmDialog(comment: string) {
    if (!dialog.yachtId || !dialog.status) return;

    // Берём актуальную строку и “нормализованную” пару (pct/final)
    const row = rows.find(r => r.yachtId === dialog.yachtId);
    const { discountPct, finalPrice } = row ? pairFromRow(row) : { discountPct: null, finalPrice: null };

    setSubmitting(true);
    setSavingId(dialog.yachtId);
    try {
      const updated = await changeStatus({
        yachtId: dialog.yachtId,
        week,
        status: dialog.status,
        comment: comment?.trim() || undefined,
        discountPct,
        finalPrice,
      });

      // Оптимистично: статус меняем сразу
      setRows(prev =>
        prev.map(r => {
          if (r.yachtId !== updated.yachtId) return r;
          const nextDecision =
            updated.decision ??
            r.decision ?? ({ status: 'DRAFT', discountPct: null, finalPrice: null } as PricingRow['decision']);
          return {
            ...r,
            decision: nextDecision,
            finalPrice: updated.finalPrice ?? r.finalPrice ?? null,
            lastComment: updated.lastComment ?? (comment?.trim() || r.lastComment) ?? null,
            lastActionAt: updated.lastActionAt ?? r.lastActionAt ?? null,
          };
        }),
      );

      // Тихо подтянем свежие значения с бэка (без спиннера)
      fetchRows(weekISO)
        .then(fresh => setRows(fresh))
        .catch(() => {
          /* игнорируем, оптимистичное состояние уже есть */
        });

      closeDialog();
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 403) {
        alert('Недостаточно прав');
      } else {
        alert('Не удалось сменить статус');
      }
    } finally {
      setSubmitting(false);
      setSavingId(null);
    }
  }

  function dialogTitle() {
    const s = dialog.status;
    if (s === 'SUBMITTED') return t('dialog.submitForApproval');
    if (s === 'APPROVED') return t('dialog.approveDecision');
    if (s === 'REJECTED') return t('dialog.rejectDecision');
    return t('dialog.changeStatus');
  }

  function onPickDate(value: string) {
    if (!value) return;
    const picked = new Date(`${value}T00:00:00Z`);
    const sat = toSaturdayUTC(picked);
    setWeek(toYMD(sat)); // ← единый формат YYYY-MM-DD
  }

  // ────────────────────────────────────────────────────────────
  // 2) renderEditors — право редактирования по статусу строки
  // ────────────────────────────────────────────────────────────
  function renderEditors(r: PricingRow) {
    const discountValue = r.decision?.discountPct ?? '';
    const finalValue = r.decision?.finalPrice ?? '';

    const st = r.decision?.status ?? 'DRAFT';
    const canEditByStatus = st === 'DRAFT' || st === 'REJECTED';
    const isDisabled = (savingId === r.yachtId) || !canEditByStatus;

    return (
      <>
        <label className="block text-xs mb-1">{t('discount')}</label>
        <div className="flex items-center">
          <input
            className="w-20 px-2 py-1 border rounded"
            type="number"
            step="0.1"
            placeholder="—"
            value={discountValue as number | string}
            onChange={(e) => canEditByStatus && onDraftDiscountChange(r.yachtId, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            onBlur={() => { if (canEditByStatus) onChangeDiscount(r.yachtId); }}
            disabled={isDisabled}
          />
          <span className="ml-1 text-gray-600">%</span>
        </div>

        <div className="h-2" />

        <label className="block text-xs mb-1">{t('finalPrice')}</label>
        <div className="flex items-center">
          <input
            className="w-28 px-2 py-1 border rounded"
            type="number"
            step="1"
            placeholder="—"
            value={finalValue as number | string}
            onChange={(e) => canEditByStatus && onDraftFinalChange(r.yachtId, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            onBlur={() => { if (canEditByStatus) onChangeFinalPrice(r.yachtId); }}
            disabled={isDisabled}
          />
          {/* <span className="ml-1 text-gray-600">€</span> */}
        </div>

        <div className="text-xs text-gray-500 mt-1">
          {t('calculated')}: {asMoney(r.finalPrice)}
        </div>
      </>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>

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
                {t('table')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${viewMode === 'cards'
                  ? 'bg-gray-900 text-white'
                  : '!text-gray-800 hover:bg-gray-100'}`}
              >
                {t('cards')}
              </button>
            </div>
          </div>

          <button
            className="px-3 py-2 rounded border"
            onClick={() => setWeek(toYMD(prevSaturday(weekDate)))}
            disabled={loading}
          >
            ◀ {t('prevWeek')}
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
            {t('nextWeek')} ▶
          </button>
        </div>
      </div>

      {error && <div className="text-red-600 mb-3">{error}</div>}

      {loading ? (
        <div className="text-gray-500">{t('loading')}</div>
      ) : rows.length === 0 ? (
        <div className="text-gray-500">{t('noRows')}</div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto border rounded-lg relative">
          <table className="min-w-full text-sm table-fixed">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="p-3 w-56 sticky left-0 bg-gray-50 z-10">{t('yacht')}</th>
                <th className="p-3 w-28 text-right">{t('base')}</th>
                <th className="p-3 w-44">{t('actuals')}</th>
                <th className="p-3 w-32 text-right">{t('maxDiscount')}</th>
                <th className="p-3 w-28 text-right">{t('top1')}</th>
                <th className="p-3 w-32 text-right">{t('avgTop3')}</th>
                <th className="p-3 w-28 text-right">{t('mlReco')}</th>
                <th className="p-3">{t('discountFinal')}</th>
                <th className="p-3">{t('status')}</th>
                <th className="p-3 w-[18rem]">{t('lastComment')}</th>
                <th className="p-3 w-48">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const st = r.decision?.status ?? 'DRAFT';
                const canSubmit = st === 'DRAFT' || st === 'REJECTED';
                const canApproveReject = st === 'SUBMITTED';
                return (
                  <tr key={r.yachtId} className="border-t">
                    <td className="p-3 sticky left-0 bg-white z-10">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-gray-500">{r.snapshot?.currency ?? 'EUR'}</div>
                    </td>
                    <td className="p-3 text-right tabular-nums">{asMoney(r.basePrice)}</td>
                    {/* NEW: Actuals column */}
                    <td className="p-3 align-top">
                      <div className="text-[11px] leading-4 text-gray-500">{t('actualPrice')}</div>
                      <div className="mb-1 text-right tabular-nums">{asMoney(r.actualPrice)}</div>

                      <div className="text-[11px] leading-4 text-gray-500">{t('actualDiscount')}</div>
                      <div className="mb-1 text-right tabular-nums">{asPercent(r.actualDiscountPercent)}</div>

                      <div className="text-[11px] leading-4 text-gray-500">{t('fetchedAt')}</div>
                      <div
                        className="text-[11px] leading-4 text-gray-500 text-right"
                        title={r.fetchedAt ?? ''}
                      >
                        {fmtWhen(r.fetchedAt ?? null)}
                      </div>
                    </td>
                    {/* NEW: Max discount % */}
                    <td className="p-3 text-right tabular-nums">{asPercent(r.maxDiscountPercent)}</td>
                    <td className="p-3 text-right tabular-nums">{asMoney(r.snapshot?.top1Price)}</td>
                    <td className="p-3 text-right tabular-nums">{asMoney(r.snapshot?.top3Avg)}</td>
                    <td className="p-3 text-right tabular-nums">{asMoney(r.mlReco)}</td>

                    <td className="p-3">{renderEditors(r)}</td>

                    {/* Status */}
                    <td className="p-3">
                      <span className="px-2 py-1 text-xs rounded bg-gray-100">{st}</span>
                    </td>

                    {/* Last comment */}
                    <td className="p-3 align-top">
                      <div className="line-clamp-2 break-words">{r.lastComment ?? '—'}</div>
                      <div className="text-xs text-gray-500 mt-1">{fmtWhen(r.lastActionAt)}</div>
                    </td>

                    {/* Actions */}
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          className="px-3 py-1 rounded text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300"
                          onClick={() => openStatusDialog(r.yachtId, 'SUBMITTED')}
                          disabled={savingId === r.yachtId || !canSubmit}
                          title={t('submit')}
                        >
                          {t('submit')}
                        </button>
                        <button
                          className="px-3 py-1 rounded text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-300"
                          onClick={() => openStatusDialog(r.yachtId, 'APPROVED')}
                          disabled={savingId === r.yachtId || !canApproveReject}
                          title={t('approve')}
                        >
                          {t('approve')}
                        </button>
                        <button
                          className="px-3 py-1 rounded text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-300"
                          onClick={() => openStatusDialog(r.yachtId, 'REJECTED')}
                          disabled={savingId === r.yachtId || !canApproveReject}
                          title={t('reject')}
                        >
                          {t('reject')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // Cards
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(r => {
            const st = r.decision?.status ?? 'DRAFT';
            const canSubmit = st === 'DRAFT' || st === 'REJECTED';
            const canApproveReject = st === 'SUBMITTED';
            const isSaving = savingId === r.yachtId;

            return (
              <div key={r.yachtId} className="border rounded-lg p-4 shadow bg-white">
                <h2 className="font-semibold text-lg mb-2">{r.name}</h2>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div className="text-gray-500">{t('base')}</div>
                  <div>{asMoney(r.basePrice)}</div>
                  {/* NEW (cards): Actuals */}
                  <div className="text-gray-500">{t('actualPrice')}</div>
                  <div>{asMoney(r.actualPrice)}</div>
                  <div className="text-gray-500">{t('actualDiscount')}</div>
                  <div>{asPercent(r.actualDiscountPercent)}</div>
                  <div className="text-gray-500">{t('fetchedAt')}</div>
                  <div className="text-xs text-gray-500">{fmtWhen(r.fetchedAt ?? null)}</div>
                  {/* NEW (cards): Max discount */}
                  <div className="text-gray-500">{t('maxDiscount')}</div>
                  <div>{asPercent(r.maxDiscountPercent)}</div>
                  <div className="text-gray-500">{t('top1')}</div>
                  <div>{asMoney(r.snapshot?.top1Price)}</div>
                  <div className="text-gray-500">{t('avgTop3')}</div>
                  <div>{asMoney(r.snapshot?.top3Avg)}</div>
                  <div className="text-gray-500">{t('mlReco')}</div>
                  <div>{asMoney(r.mlReco)}</div>
                </div>

                <div className="mt-3">
                  <div className="relative inline-flex">
                    <input
                      className="w-24 pr-6 px-2 py-1 border rounded"
                      type="number"
                      step="0.1"
                      placeholder="—"
                      value={(r.decision?.discountPct ?? '') as number | string}
                      onChange={(e) =>
                        (st === 'DRAFT' || st === 'REJECTED') &&
                        onDraftDiscountChange(r.yachtId, e.target.value)
                      }
                      onKeyDown={(e) =>
                        e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()
                      }
                      onBlur={() => {
                        if (st === 'DRAFT' || st === 'REJECTED') onChangeDiscount(r.yachtId)
                      }}
                      disabled={isSaving || !(st === 'DRAFT' || st === 'REJECTED')}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600">
                      %
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs mb-1">{t('finalPrice')}</label>

                  <div className="relative inline-flex">
                    <input
                      className="w-32 pr-6 px-2 py-1 border rounded"
                      type="number"
                      step="1"
                      placeholder="—"
                      value={(r.decision?.finalPrice ?? '') as number | string}
                      onChange={(e) =>
                        (st === 'DRAFT' || st === 'REJECTED') &&
                        onDraftFinalChange(r.yachtId, e.target.value)
                      }
                      onKeyDown={(e) =>
                        e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()
                      }
                      onBlur={() => {
                        if (st === 'DRAFT' || st === 'REJECTED') onChangeFinalPrice(r.yachtId)
                      }}
                      disabled={isSaving || !(st === 'DRAFT' || st === 'REJECTED')}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600">
                      €
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    {t('calculated')}: {asMoney(r.finalPrice)}
                  </div>
                </div>

                {/* Footer: статус + кнопки */}
               <div className="mt-4 flex items-center gap-2">
                    <span className="px-2 py-1 text-xs rounded bg-gray-100">{st}</span>
                    <div className="flex gap-2 ml-auto">
                      <button
                        className="px-3 py-1 rounded text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300"
                        onClick={() => openStatusDialog(r.yachtId, 'SUBMITTED')}
                        disabled={isSaving || !canSubmit}
                        title={t('submit')}
                      >
                        {t('submit')}
                      </button>
                      <button
                        className="px-3 py-1 rounded text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-300"
                        onClick={() => openStatusDialog(r.yachtId, 'APPROVED')}
                        disabled={isSaving || !canApproveReject}
                        title={t('approve')}
                      >
                        {t('approve')}
                      </button>
                      <button
                        className="px-3 py-1 rounded text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-300"
                        onClick={() => openStatusDialog(r.yachtId, 'REJECTED')}
                        disabled={isSaving || !canApproveReject}
                        title={t('reject')}
                      >
                        {t('reject')}
                      </button>
                    </div>
                  </div>

                  {/* Last comment + time */}
                  <div className="mt-3 border-t pt-3">
                    <div className="text-xs text-gray-500 mb-1">{t('lastComment')}</div>
                    <div className="text-sm break-words">{r.lastComment ?? '—'}</div>
                    <div className="text-xs text-gray-500 mt-1">{fmtWhen(r.lastActionAt)}</div>
                  </div>
                </div>
            )
          })}
        </div>
      )}

      {/* Диалог комментариев / подтверждения */}
      <ConfirmActionModal
        open={dialog.open}
        title={dialogTitle()}
        confirmLabel={
          dialog.status === 'SUBMITTED'
            ? t('submit')
            : dialog.status === 'APPROVED'
            ? t('approve')
            : dialog.status === 'REJECTED'
            ? t('reject')
            : t('confirm')
        }
        placeholder={
          dialog.status === 'REJECTED'
            ? t('placeholders.rejectWhy')
            : t('placeholders.comment')
        }
        submitting={submitting}
        onCancel={closeDialog}
        onConfirm={confirmDialog}
      />
    </div>
  );
}