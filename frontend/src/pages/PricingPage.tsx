// frontend/src/pages/PricingPage.tsx

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  changeStatus,
  fetchRows,
  upsertDecision,
  buildSubmitPayload,
  getLastEdited,
} from '../api/pricing';
import type { ScrapeSource } from '../api';
import type { PricingRow, DecisionStatus } from '../api/pricing';
import { toYMD, nextSaturday, prevSaturday, toSaturdayUTC } from '../utils/week';
import ConfirmActionModal from '@/components/ConfirmActionModal';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { HeaderWithSourceBadge } from '../components/HeaderWithSourceBadge';
import PricingSearchBar from '../components/PricingSearchBar';
import { API_BASE } from '../api';

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

// Pricing-page rule:
// "Price" column must always show week base price (row.basePrice).
const weekBasePrice = (row: PricingRow) => row.basePrice;

export default function PricingPage() {
  // i18n
  const { t } = useTranslation('pricing');

  // query-параметры, чтобы читать/писать ?week=...
  const [searchParams, setSearchParams] = useSearchParams();

  // ─────────────────────────────────────────────
  // source (INNERDB / NAUSYS), синхронно с URL
  // ─────────────────────────────────────────────
  const [scanSource, setScanSource] = useState<ScrapeSource>(() => {
    const raw = (searchParams.get('source') || '').toUpperCase();
    if (raw === 'INNERDB' || raw === 'NAUSYS') return raw as ScrapeSource;
    const ls = (localStorage.getItem('competitor:scanSource') || 'INNERDB').toUpperCase();
    if (ls === 'INNERDB' || ls === 'NAUSYS') return ls as ScrapeSource;
    return 'INNERDB';
  });

  // ────────────────────────────────────────────────────────────
  // 1) Неделя всегда в формате YYYY-MM-DD (plain date)
  //    Инициализируемся из ?week=, если он валиден
  // ────────────────────────────────────────────────────────────
  const [week, setWeek] = useState(() => {
    const fromUrl = searchParams.get('week');
    if (fromUrl) {
      const parsed = new Date(`${fromUrl}T00:00:00Z`);
      if (!Number.isNaN(parsed.getTime())) {
        return toYMD(toSaturdayUTC(parsed));
      }
    }
    return toYMD(toSaturdayUTC(new Date()));
  });

  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [error, setError] = useState<string | null>(null);

  // NEW: search filter (like Dashboard)
  const [q, setQ] = useState('');

  // NEW: sorting for Pricing table/cards (only Yacht name + Price)
  type SortKey = 'name' | 'price';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const toggleSort = useCallback((key: SortKey) => {
    setSortDir((prev) => (key === sortKey ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortKey(key);
  }, [sortKey]);

  // NEW: флаг выгрузки в NauSYS
  const [exporting, setExporting] = useState(false);

  // NEW: год для экспорта NauSYS (по умолчанию — текущий)
  const [exportYear, setExportYear] = useState<number>(() => new Date().getFullYear()); 

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

  // 1a) если кто-то снаружи поменял ?source= — подтягиваем в state
  useEffect(() => {
    const raw = (searchParams.get('source') || '').toUpperCase();
    if (raw === 'INNERDB' || raw === 'NAUSYS') {
      setScanSource(prev => (prev === raw ? prev : (raw as ScrapeSource)));
    }
  }, [searchParams]);

  // 1b) Любое изменение недели локально — записываем в URL, сохраняя остальные query
  useEffect(() => {
    const current = searchParams.get('week') || '';
    if (current === week) return;
    const next = new URLSearchParams(searchParams);
    next.set('week', week);
    setSearchParams(next, { replace: true });
  }, [week, searchParams, setSearchParams]);

  // 1c) Любое изменение source локально — пишем в URL и localStorage
  useEffect(() => {
    localStorage.setItem('competitor:scanSource', scanSource);
    const current = (searchParams.get('source') || '').toUpperCase();
    if (current === scanSource) return;
    const next = new URLSearchParams(searchParams);
    next.set('source', scanSource);
    setSearchParams(next, { replace: true });
  }, [scanSource, searchParams, setSearchParams]); 

  // ─ загрузка ─
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRows(weekISO, scanSource);
        if (alive) setRows(data);
      } catch (e) {
        console.error(e);
        const msg = t('loadError', 'Failed to load pricing rows');
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
  }, [weekISO, scanSource, t]);

  // ─ local filtering (name + model) ─
  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const name = (r.name ?? '').toLowerCase();
      const model = (r.modelName ?? '').toLowerCase();
      return name.includes(needle) || model.includes(needle);
    });
  }, [rows, q]);

  const resetSearch = useCallback(() => setQ(''), []);

  // NEW: sorted rows (after filtering)
  const sortedRows = useMemo(() => {
   const arr = [...filteredRows];
    arr.sort((a, b) => {
      if (sortKey === 'name') {
        const av = (a.name ?? '').toLowerCase();
        const bv = (b.name ?? '').toLowerCase();
        const cmp = av.localeCompare(bv);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      // sortKey === 'price'
      // use the same number that is shown in the "Price" column: getBaseForRow(row)
      const av = weekBasePrice(a) ?? 0;
      const bv = weekBasePrice(b) ?? 0;
      const cmp = av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filteredRows, sortKey, sortDir]);

  const sortIndicator = useCallback((key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? '↑' : '↓';
  }, [sortKey, sortDir]);  


  // ─ локальный драфт ─
  const onDraftDiscountChange = useCallback((yachtId: string, valueStr: string) => {
    const discount = toNumberOrNull(valueStr);
    setRows(prev =>
      prev.map(r => {
        if (r.yachtId !== yachtId) return r;
        const base = weekBasePrice(r);
        const newFinal = calcFinal(base, discount);
        return {
          ...r,
          draftSource: 'discount',
          finalPrice: newFinal,
          decision: {
            status: r.decision?.status ?? 'DRAFT',
            discountPct: discount,
            finalPrice: newFinal,
            __lastEdited: 'discount',
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
        const base = weekBasePrice(r);
        const newDiscount = calcDiscountPct(base, finalPrice);
        return {
          ...r,
          draftSource: 'final',
          finalPrice,
          decision: {
            status: r.decision?.status ?? 'DRAFT',
            discountPct: newDiscount,
            finalPrice,
            __lastEdited: 'final',
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
    const base = weekBasePrice(row);

    // если последним редактировали "цену руками" — её не трогаем
    const lastEdited = getLastEdited(row.decision);
    
    const finalPrice =
      lastEdited === 'final'
        ? (row.decision?.finalPrice ?? null)
        : calcFinal(base, discountPct);

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
  const base = weekBasePrice(row);

  // 👉 discount — вторичен, считаем от введённой цены
  const discountPct = calcDiscountPct(base, finalPrice);

  // если цена не менялась — ничего не делаем
  if (finalPrice === row.decision?.finalPrice) return;

    setSavingId(yachtId);
    try {
      const updated = await upsertDecision({ yachtId, week: weekISO, finalPrice, discountPct });
      setRows(prev => prev.map(r => (r.yachtId === yachtId ? { ...r, ...updated } : r)));
    } catch (e: unknown) {
      // 403 для автосейва по blur показывать не обязательно
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status && status !== 403) {
        alert(t('alerts.saveDraftFailed', 'Failed to save draft'));
      }
    } finally {
      setSavingId(null);
    }
  }

  // ─ выгрузка для NauSYS ─
  async function handleExportNausys() {
    try {
      setExporting(true);

      // Берём явно выбранный год (либо текущий как запасной вариант)
      const year = exportYear || new Date().getFullYear();

      const url = `${API_BASE}/nausys/export-prices?year=${year}`;

      // ⚠ fetch используем напрямую, чтобы отработал download
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          // axios-интерсептор токен сюда НЕ добавит — нужно вручную
          Authorization: `Bearer ${await window.Clerk?.session?.getToken()}`,
        },
      });

      if (!res.ok) {
        alert(
          t(
            'alerts.exportError',
            'NauSYS export error: {{status}}',
            { status: res.status },
          ),
        );
        return;
      }

      // Получаем CSV как Blob
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      // Создаём скрытую ссылку для скачивания
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `nausys-prices-${year}.csv`;
      a.click();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(err);
      alert(
        t(
          'alerts.exportFailed',
          'Failed to export for NauSYS. See console for details.',
        ),
      );
    } finally {
      setExporting(false);
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

    const row = rows.find(r => r.yachtId === dialog.yachtId);
    if (!row) return;

    // 🔹 что именно отправляем (ТОЛЬКО одно поле)
    const submitPayload = buildSubmitPayload(row);

    // 🔹 справочная скидка — ТОЛЬКО для проверки лимита
    let discountForCheck: number | null = null;

    if ('finalPrice' in submitPayload && submitPayload.finalPrice != null) {
      discountForCheck = calcDiscountPct(weekBasePrice(row), submitPayload.finalPrice);
    } else if ('discountPct' in submitPayload && submitPayload.discountPct != null) {
      discountForCheck = submitPayload.discountPct;
    }

    // 👉 клиентская проверка лимита (только при SUBMITTED)
    if (
      dialog.status === 'SUBMITTED' &&
      row.maxDiscountPercent != null &&
      discountForCheck != null &&
      discountForCheck > row.maxDiscountPercent
    ) {
      alert(
        t(
          'alerts.discountLimitExceeded',
          'Discount {{discount}}% exceeds limit {{limit}}%.',
          {
            discount: discountForCheck,
            limit: row.maxDiscountPercent,
          },
        ),
      );
      return;
    }

    setSubmitting(true);
    setSavingId(dialog.yachtId);

    try {
      const updated = await changeStatus({
        yachtId: dialog.yachtId,
        week,
        status: dialog.status,
        comment: comment?.trim() || undefined,
        ...submitPayload, // ✅ только source field
      });

      // 🔹 оптимистичное обновление
      setRows(prev =>
        prev.map(r => {
          if (r.yachtId !== updated.yachtId) return r;

          const nextDecision =
            updated.decision ??
            r.decision ??
            ({ status: 'DRAFT', discountPct: null, finalPrice: null } as PricingRow['decision']);

          return {
            ...r,
            decision: nextDecision,
            finalPrice: updated.finalPrice ?? r.finalPrice ?? null,
            lastComment: updated.lastComment ?? (comment?.trim() || r.lastComment) ?? null,
            lastActionAt: updated.lastActionAt ?? r.lastActionAt ?? null,
          };
        }),
      );

      // 🔹 тихо подтянуть свежие данные
      fetchRows(weekISO)
        .then(fresh => setRows(fresh))
        .catch(() => { });

      closeDialog();
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 403) {
        alert(t('alerts.forbidden', 'Insufficient permissions'));
      } else {
        alert(t('alerts.statusChangeFailed', 'Failed to change status'));
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
    if (s === 'DRAFT') return t('dialog.reopenDecision', 'Reopen for approval');
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
    // лимит и флаг превышения
    const limit = r.maxDiscountPercent ?? null;
    const isOver =
      typeof discountValue === 'number' &&
      limit != null &&
      discountValue > limit;

    return (
      <>
          <label className="block text-xs mb-1">
          {t('discount')}
          {limit != null && (
            <span className="ml-2 text-[11px] text-gray-500">
              ({t('maxDiscount')} {limit}%)
            </span>
          )}
        </label>
        <div className="flex items-center">
          <input
            className={`w-20 px-2 py-1 border rounded ${
              isOver
                ? 'border-2 border-red-500 outline-red-500 ring-1 ring-red-300 bg-red-50'
                : ''
            }`}
            type="number"
            step="1" // изменено с 0.1 на 1
            placeholder="—"
            value={discountValue as number | string}
            onChange={(e) => canEditByStatus && onDraftDiscountChange(r.yachtId, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            onBlur={() => { if (canEditByStatus) onChangeDiscount(r.yachtId); }}
            disabled={isDisabled}
          />
          <span className="ml-1 text-gray-600">%</span>
        </div>
        {isOver && (
          <div className="mt-1 text-xs text-red-600">
            {t('maxDiscount')}: {limit}%
          </div>
        )}

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
      {/* Заголовок + блок управления неделей, источником и видом */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          {/* бейдж Source: ... такой же, как на Dashboard */}
          <HeaderWithSourceBadge />
        </div>

        {/* Блок выбора недели + кнопка выгрузки для NauSYS */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="px-3 py-2 rounded border"
              onClick={() => setWeek(toYMD(prevSaturday(weekDate)))}
              disabled={loading}
            >
              ◀
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
              ▶
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Ввод года для экспорта NauSYS */}
            <label className="flex items-center gap-2 text-sm text-gray-600">
              {t('exportYear', 'Year')}
              <input
                type="number"
                min={2020}
                max={2100}
                value={exportYear}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) {
                    setExportYear(v);
                  }
                }}
                className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </label>

            <button
              type="button"
              onClick={handleExportNausys}
              disabled={loading || exporting}
              className="inline-flex items-center rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium
                         text-blue-600 hover:bg-blue-50 disabled:opacity-60 disabled:hover:bg-transparent"
            >
              {exporting
                ? t('exportNausysInProgress', 'Exporting for NauSYS…')
                : t('exportNausys', 'Export for NauSYS')}
            </button>
          </div>

        </div>

        {/* Переключатель вида — под выбором недели */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                viewMode === 'table'
                  ? 'bg-gray-900 text-white'
                  : '!text-gray-800 hover:bg-gray-100'
              }`}
            >
              {t('table')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                viewMode === 'cards'
                  ? 'bg-gray-900 text-white'
                  : '!text-gray-800 hover:bg-gray-100'
              }`}
            >
              {t('cards')}
            </button>
          </div>
        </div>
      </div>

      {/* Search (like Dashboard) */}
      <PricingSearchBar
        q={q}
        setQ={setQ}
        onReset={resetSearch}
        total={rows.length}
        filtered={filteredRows.length}
      />

      {error && <div className="text-red-600 mb-3">{error}</div>}

      {loading ? (
        <div className="text-gray-500">{t('loading')}</div>
      ) : filteredRows.length === 0 ? (
        <div className="text-gray-500">{t('noRows')}</div>
      ) : viewMode === 'table' ? (
        <div className="border rounded-lg relative max-h-[70vh] overflow-auto">
          <table className="min-w-full text-sm table-fixed">
            <thead className="bg-gray-50 sticky top-0 z-20">
              <tr className="text-left">

                <th
                  className="p-3 w-56 sticky left-0 bg-gray-50 z-10 cursor-pointer select-none"
                  onClick={() => toggleSort('name')}
                  title={t('sortByYacht', 'Sort by yacht name')}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('yacht')}
                    <span className={sortKey === 'name' ? 'text-blue-600 font-bold' : 'text-gray-400'}>
                      {sortIndicator('name')}
                    </span>
                  </span>
                </th>
                <th
                  className="p-3 w-28 text-right cursor-pointer select-none"
                  onClick={() => toggleSort('price')}
                  title={t('sortByPrice', 'Sort by price')}
                >
                  <span className="inline-flex items-center justify-end gap-1 w-full">
                    {t('base')}
                    <span className={sortKey === 'price' ? 'text-blue-600 font-bold' : 'text-gray-400'}>
                      {sortIndicator('price')}
                    </span>
                  </span>
                </th>

                <th className="p-3 w-44">{t('actuals')}</th>
                <th className="p-3 w-32 text-right">{t('maxDiscount')}</th>
                <th className="p-3 w-28 text-right">{t('top1')}</th>
                <th className="p-3 w-32 text-right">{t('avgTop3')}</th>
                <th className="p-3 w-28 text-right">{t('mlReco')}</th>
                <th className="p-3">{t('discountFinal')}</th>
                <th className="p-3">{t('statusColumn')}</th>
                <th className="p-3 w-[18rem]">{t('lastComment')}</th>
                <th className="p-3 w-48">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const st = r.decision?.status ?? 'DRAFT'
                const canSubmit = st === 'DRAFT' || st === 'REJECTED'
                const canApproveReject = st === 'SUBMITTED'

                // NEW: reopen (APPROVED -> DRAFT) только для тех, у кого есть approve/reject perms
                const canReopen = st === 'APPROVED' && !!r.perms?.canReopen

                return (
                  <tr key={r.yachtId} className="border-t">
                    <td className="p-3 sticky left-0 bg-white z-10">
                      <div className="font-medium">
                        <Link
                          to={{
                            pathname: `/yacht/${r.yachtId}`,
                            search: `?week=${week}`,
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          {r.name}
                        </Link>
                      </div>
                      {r.modelName ? (
                        <div className="text-xs text-gray-600">{r.modelName}</div>
                      ) : null}
                    </td>
                    {/* База: показываем эффективную цену для недели */}
                    <td className="p-3 text-right tabular-nums">
                      {asMoney(weekBasePrice(r))}
                    </td>
                    {/* NEW: Actuals column */}
                    <td className="p-3 align-top">
                      <div className="text-[11px] leading-4 text-gray-500">{t('actualPrice')}</div>
                      <div className="mb-1 text-right tabular-nums">{asMoney(r.actualPrice)}</div>

                      <div className="text-[11px] leading-4 text-gray-500">
                        {t('actualDiscount')}
                      </div>
                      <div className="mb-1 text-right tabular-nums">
                        {asPercent(r.actualDiscountPercent)}
                      </div>

                      <div className="text-[11px] leading-4 text-gray-500">{t('fetchedAt')}</div>
                      <div
                        className="text-[11px] leading-4 text-gray-500 text-right"
                        title={r.fetchedAt ?? ''}
                      >
                        {fmtWhen(r.fetchedAt ?? null)}
                      </div>
                    </td>
                    {/* NEW: Max discount % */}
                    <td className="p-3 text-right tabular-nums">
                      {asPercent(r.maxDiscountPercent)}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {asMoney(r.snapshot?.top1Price)}
                    </td>
                    <td className="p-3 text-right tabular-nums">{asMoney(r.snapshot?.top3Avg)}</td>
                    <td className="p-3 text-right tabular-nums">{asMoney(r.mlReco)}</td>

                    <td className="p-3">{renderEditors(r)}</td>

                    {/* Status */}
                    <td className="p-3">
                      <span className="px-2 py-1 text-xs rounded bg-gray-100">
                        {t(`status.${st}`, st)}
                      </span>
                    </td>

                    {/* Last comment */}
                    <td className="p-3 align-top">
                      <div className="line-clamp-2 break-words">{r.lastComment ?? '—'}</div>
                      <div className="text-xs text-gray-500 mt-1">{fmtWhen(r.lastActionAt)}</div>
                    </td>

                    {/* Actions */}
                    <td className="p-3">
                      <div className="flex gap-2 flex-wrap">
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

                        {/* NEW: Reopen */}
                        <button
                          className="px-3 py-1 rounded text-white bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
                          onClick={() => openStatusDialog(r.yachtId, 'DRAFT')}
                          disabled={savingId === r.yachtId || !canReopen}
                          title={t('reopen', 'Reopen')}
                        >
                          {t('reopen', 'Reopen')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // Cards
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedRows.map((r) => {
            const st = r.decision?.status ?? 'DRAFT'
            const canSubmit = st === 'DRAFT' || st === 'REJECTED'
            const canApproveReject = st === 'SUBMITTED'
            const canReopen = st === 'APPROVED' && !!r.perms?.canReopen
            const isSaving = savingId === r.yachtId
            const limit = r.maxDiscountPercent ?? null;
            const discVal = r.decision?.discountPct ?? '';
            const isOver =
              typeof discVal === 'number' && limit != null && discVal > limit;

            return (
              <div key={r.yachtId} className="border rounded-lg p-4 shadow bg-white">
                <h2 className="font-semibold text-lg mb-2">
                  <Link
                    to={{
                      pathname: `/yacht/${r.yachtId}`,
                      search: `?week=${week}`,
                    }}
                    className="text-blue-600 hover:underline"
                  >
                    {r.name}
                  </Link>
                </h2>
                {r.modelName ? (
                  <div className="text-xs text-gray-600 -mt-1 mb-2">{r.modelName}</div>
                ) : null}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
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
                      className={`w-24 pr-6 px-2 py-1 border rounded ${
                        isOver
                          ? 'border-2 border-red-500 outline-red-500 ring-1 ring-red-300 bg-red-50'
                          : ''
                      }`}
                      type="number"
                      step="1" // изменено с 0.1 на 1
                      placeholder="—"
                      value={discVal as number | string}
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
                  {isOver && (
                    <div className="mt-1 text-xs text-red-600">
                      {t('maxDiscount')}: {limit}%
                    </div>
                  )}
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
                <div className="mt-4 flex flex-col gap-2">
                  <span className="self-start px-2 py-1 text-xs rounded bg-gray-100">
                    {t(`status.${st}`, st)}
                  </span>

                  <div className="flex flex-wrap gap-2 justify-start">
                    <button
                      className="px-3 py-1 rounded text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300"
                      onClick={() => openStatusDialog(r.yachtId, 'SUBMITTED')}
                      disabled={isSaving || !canSubmit || isOver}
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

                    <button
                      className="px-3 py-1 rounded text-white bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
                      onClick={() => openStatusDialog(r.yachtId, 'DRAFT')}
                      disabled={isSaving || !canReopen}
                      title={t('reopen', 'Reopen')}
                    >
                      {t('reopen', 'Reopen')}
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
                : dialog.status === 'DRAFT'
                  ? t('reopen', 'Reopen')
                  : t('confirm')
        }
        placeholder={
          dialog.status === 'REJECTED' ? t('placeholders.rejectWhy') : t('placeholders.comment')
        }
        submitting={submitting}
        onCancel={closeDialog}
        onConfirm={confirmDialog}
      />
    </div>
  )
}