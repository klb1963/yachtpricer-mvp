// frontend/src/components/yacht/YachtPricingSection.tsx

import { useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { Legend } from '../../form/Legend';
import type { Yacht } from '../../../api';
import { Field } from '../../form/Field';

// ✅ PriceListNode API
import {
  listPriceListNodes,
  upsertPriceListNode,
  deletePriceListNode,
  type PriceListNode,
} from '../../../api';

type Props = {
  // Стартовая базовая цена яхты (записывается в Yacht.basePrice)
  basePrice: string;
  maxDiscountPct: string; // оставили в пропсах, но не редактируем здесь
  onBasePriceChange: (value: string) => void;
  onMaxDiscountPctChange: (value: string) => void; // не используется, но оставляем для совместимости
  yacht: Yacht | null;
  t: TFunction<'yacht'>;
};

type DraftNodeRow = {
  id?: string;
  weekStartIso?: string; // ISO из бэка (нужно для DELETE)
  weekDate: string; // YYYY-MM-DD для input[type=date]
  price: string; // как строка, чтобы держать пустое значение
  saving?: boolean;
  deleting?: boolean;
  error?: string | null;
};

function isoToDate(iso: string): string {
  return (iso ?? '').slice(0, 10);
}

// "YYYY-MM-DD" -> Date (UTC)
function parseIsoDateToUtc(isoDate: string): Date | null {
  if (!isoDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0));
}

// Нормализуем выбранную дату к "weekStart" (start of week) в UTC.
// ⚠️ Я оставляю Monday-start (ISO week). Если у вас на бэке Sunday-start — поменяй формулу.
function normalizeToWeekStartIsoDate(inputDate: string): string | null {
  const dt = parseIsoDateToUtc(inputDate);
  if (!dt) return null;

  // JS: getUTCDay(): 0=Sun..6=Sat
  const dow = dt.getUTCDay();
  // хотим Monday=0..Sunday=6
  const mondayBased = (dow + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - mondayBased);

  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// "YYYY-MM-DD" -> "DD.MM.YYYY"
function formatRuDateFromIso(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function YachtPricingSection({
  basePrice,
  maxDiscountPct, // eslint-disable-line @typescript-eslint/no-unused-vars
  onBasePriceChange,
  onMaxDiscountPctChange, // eslint-disable-line @typescript-eslint/no-unused-vars
  yacht,
  t,
}: Props) {
  // базовая цена по выбранной неделе (read-only)
  const readonlyBasePrice = (() => {
    if (!yacht) return '—';
    const p =
      yacht.currentBasePrice != null
        ? yacht.currentBasePrice
        : typeof yacht.basePrice === 'string'
          ? Number(yacht.basePrice)
          : (yacht.basePrice as number | undefined);

    if (p == null || !Number.isFinite(p)) return '—';
    return String(Math.round(p));
  })();

  // ─────────────────────────────────────────────────────────────
  // PriceListNodes UI state
  // ─────────────────────────────────────────────────────────────
  const yachtId = yacht?.id ?? null;

  const [nodesLoading, setNodesLoading] = useState(false);
  const [nodesError, setNodesError] = useState<string | null>(null);
  const [rows, setRows] = useState<DraftNodeRow[]>([]);

  async function reloadNodes() {
    if (!yachtId) return;
    setNodesLoading(true);
    setNodesError(null);
    try {
      const list: PriceListNode[] = await listPriceListNodes(yachtId);
      const sorted = list.slice().sort((a, b) => a.weekStart.localeCompare(b.weekStart));

      setRows(
        sorted.map((n) => ({
          id: n.id,
          weekStartIso: n.weekStart,
          weekDate: isoToDate(n.weekStart),
          price: String(n.price ?? ''),
          error: null,
        })),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load price list nodes';
      setNodesError(msg);
    } finally {
      setNodesLoading(false);
    }
  }

  useEffect(() => {
    if (!yachtId) return;
    void reloadNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yachtId]);

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: undefined,
        weekStartIso: undefined,
        weekDate: '',
        price: '',
        error: null,
      },
    ]);
  }

  // ✅ существующие weekStart (из сохранённых строк)
  const existingWeekStarts = useMemo(() => {
    return new Set(
      rows
        .map((r) => r.weekStartIso)
        .filter((v): v is string => Boolean(v))
        .map((iso) => isoToDate(iso)), // сравниваем по YYYY-MM-DD
    );
  }, [rows]);

  // ✅ дубль = нормализованный weekStart совпал с уже существующим,
  // но это не "сама же строка" (т.е. не совпадает с её текущим weekStartIso)
  function rowHasDuplicateNormalizedWeek(idx: number): boolean {
    const r = rows[idx];
    const normalized = normalizeToWeekStartIsoDate(r.weekDate);
    if (!normalized) return false;
    if (r.weekStartIso && normalized === isoToDate(r.weekStartIso)) return false;
    return existingWeekStarts.has(normalized);
  }

  async function saveRow(idx: number) {
    if (!yachtId) return;
    const r = rows[idx];

    setRows((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, saving: true, error: null } : x)),
    );

    try {
      const week = r.weekDate?.trim();
      const priceNum = Number(String(r.price).replace(',', '.'));

      if (!week) throw new Error(t('pricing.errors.weekRequired', 'Week is required'));
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        throw new Error(t('pricing.errors.pricePositive', 'Price must be a positive number'));
      }

      await upsertPriceListNode({
        yachtId,
        weekStart: week, // YYYY-MM-DD — бэк сам нормализует к weekStart (UTC)
        price: priceNum,
        currency: 'EUR',
        source: 'INTERNAL',
      });

      await reloadNodes(); // важно: получить нормализованный weekStart ISO от бэка
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('pricing.errors.saveFailed', 'Save failed');
      setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, error: msg } : x)));
    } finally {
      setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, saving: false } : x)));
    }
  }

  async function removeRow(idx: number) {
    if (!yachtId) return;
    const r = rows[idx];

    // draft row → просто убрать локально
    if (!r.id || !r.weekStartIso) {
      setRows((prev) => prev.filter((_, i) => i !== idx));
      return;
    }

    setRows((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, deleting: true, error: null } : x)),
    );

    try {
      await deletePriceListNode({
        yachtId,
        weekStart: r.weekStartIso, // строго ISO из бэка
      });
      await reloadNodes();
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : t('pricing.errors.deleteFailed', 'Delete failed');
      setRows((prev) =>
        prev.map((x, i) => (i === idx ? { ...x, deleting: false, error: msg } : x)),
      );
      return;
    }

    setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, deleting: false } : x)));
  }

  const currentDiscount =
    yacht?.currentDiscountPct != null && Number.isFinite(yacht.currentDiscountPct)
      ? `${yacht.currentDiscountPct}%`
      : '—';

  const maxDiscount =
    yacht?.maxDiscountPct != null && Number.isFinite(yacht.maxDiscountPct)
      ? `${yacht.maxDiscountPct}%`
      : maxDiscountPct
        ? `${maxDiscountPct}%`
        : '—';

  const updatedAtIso = yacht?.currentPriceUpdatedAt ?? yacht?.fetchedAt ?? null;
  const updatedAtStr = updatedAtIso != null ? new Date(updatedAtIso).toLocaleString() : '—';

  return (
    <fieldset className="rounded-2xl border p-5">
      <Legend>{t('sections.pricing')}</Legend>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Базовая цена (read-only, из WeekSlot/basePrice) */}
        <label className="flex flex-col">
          <span className="text-sm text-gray-600">{t('fields.basePrice', 'Base price')}</span>
          <input className="mt-1 rounded border p-2 bg-gray-50" readOnly value={readonlyBasePrice} />
        </label>

        {/* Текущая скидка (read-only) */}
        <label className="flex flex-col">
          <span className="text-sm text-gray-600">
            {t('fields.currentDiscountPct', 'Current discount')}
          </span>
          <input className="mt-1 rounded border p-2 bg-gray-50" readOnly value={currentDiscount} />
        </label>

        {/* Max discount — логика как у Starting base price */}
        {yacht == null ? (
          <Field
            label={t('fields.maxDiscountPct', 'Max. discount %') + ' *'}
            value={maxDiscountPct}
            onChange={(e) => onMaxDiscountPctChange(e.target.value)}
          />
        ) : (
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">{t('fields.maxDiscountPct', 'Max. discount %')}</span>
            <input
              className="mt-1 rounded border p-2 bg-gray-50 text-gray-500 cursor-not-allowed"
              readOnly
              value={maxDiscount}
            />
            <span className="mt-1 text-xs text-gray-400">
              {t(
                'pricing.maxDiscountHint',
                'This value is set only when creating the yacht and cannot be changed later.',
              )}
            </span>
          </label>
        )}
      </div>

      <div className="mt-3 text-xs text-gray-500">
        {t('pricing.priceUpdatedAt', 'Price updated at')}: {updatedAtStr}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          PriceListNode management (only for existing яхты)
         ───────────────────────────────────────────────────────────── */}
      {yacht != null && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{t('pricing.basePriceNodes', 'Price list')}</div>
            <button
              type="button"
              onClick={addRow}
              className="rounded-lg border px-3 py-1.5 hover:bg-gray-50"
              title={t('actions.add', 'Add')}
            >
              +
            </button>
          </div>

          {nodesError && <div className="mt-2 text-sm text-red-600">{nodesError}</div>}

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-3">{t('pricing.week', 'Week')}</th>
                  <th className="py-2 pr-3">{t('pricing.price', 'Price')}</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>

              <tbody>
                {nodesLoading && rows.length === 0 ? (
                  <tr>
                    <td className="py-3 text-gray-500" colSpan={3}>
                      {t('loading', 'Loading…')}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="py-3 text-gray-500" colSpan={3}>
                      {t('pricing.noNodes', 'No nodes yet')}
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => {
                    const normalized = normalizeToWeekStartIsoDate(r.weekDate);
                    const normalizedLabel = normalized ? formatRuDateFromIso(normalized) : '—';
                    const hasDup = rowHasDuplicateNormalizedWeek(idx);

                    return (
                      <tr key={r.id ?? `new-${idx}`} className="border-t align-top">
                        <td className="py-2 pr-3">
                          <div className="flex flex-col">
                            <input
                              type="date"
                              className="h-10 w-full rounded border px-2"
                              value={r.weekDate}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, weekDate: e.target.value } : x)),
                                )
                              }
                            />

                            <div className="mt-1 text-[11px] leading-4 text-gray-500">
                              {t('pricing.willBeSavedAs', 'Will be saved as weekStart')}:{' '}
                              <span className="font-medium">{normalizedLabel}</span>
                            </div>

                            {hasDup && (
                              <div className="mt-1 text-[11px] leading-4 text-red-600">
                                {t(
                                  'pricing.duplicateWeek',
                                  'This week already exists in the table — saving will update that week.',
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-2 pr-3">
                          <div className="flex flex-col">
                            <input
                              type="number"
                              className="h-10 w-full rounded border px-2"
                              value={r.price}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, price: e.target.value } : x)),
                                )
                              }
                            />
                            {r.error && <div className="mt-1 text-xs leading-4 text-red-600">{r.error}</div>}
                            {/* держим одинаковую высоту "подвала" даже без ошибки */}
                            {!r.error && <div className="mt-1 text-xs leading-4 opacity-0">.</div>}
                          </div>
                        </td>

                        <td className="py-2 pr-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => saveRow(idx)}
                            disabled={!!r.saving || !!r.deleting}
                            className="mr-2 h-10 rounded-lg border px-3 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {r.saving
                              ? t('actions.saving', 'Saving…')
                              : hasDup
                                ? t('actions.update', 'Update')
                                : t('actions.save', 'Save')}
                          </button>

                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            disabled={!!r.saving || !!r.deleting}
                            className="h-10 rounded-lg border px-3 hover:bg-gray-50 disabled:opacity-50"
                            title={t('actions.delete', 'Delete')}
                          >
                            –
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div className="mt-2 text-xs text-gray-500">
              {t('pricing.nodesHint', 'Week will be normalized to the start of week on save.')}
            </div>
          </div>
        </div>
      )}

      {/* Starting base price:
            - при создании яхты (yacht == null) — редактируемое поле
            - при редактировании существующей — только read-only */}
      {yacht == null ? (
        <div className="mt-4 max-w-xs">
          <Field
            label={t('fields.startingBasePrice', 'Starting base price')}
            value={basePrice}
            onChange={(e) => onBasePriceChange(e.target.value)}
          />
        </div>
      ) : (
        <div className="mt-4 max-w-xs">
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">{t('fields.startingBasePrice', 'Starting base price')}</span>
            <input
              className="mt-1 rounded border p-2 bg-gray-50 text-gray-500 cursor-not-allowed"
              readOnly
              value={basePrice}
            />
            <span className="mt-1 text-xs text-gray-400">
              {t(
                'pricing.startingBasePriceHint',
                'This value is set only when creating the yacht and cannot be changed later.',
              )}
            </span>
          </label>
        </div>
      )}
    </fieldset>
  );
}