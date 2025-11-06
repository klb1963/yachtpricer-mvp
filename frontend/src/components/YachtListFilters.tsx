// /frontend/src/components/YachtListFilters.tsx

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findCategories, type CatalogCategory } from '../api';

type SortKey = 'createdDesc' | 'priceAsc' | 'priceDesc' | 'yearAsc' | 'yearDesc';

const SORT_OPTIONS = (t: (k: string) => string) => [
  { value: 'createdDesc', label: t('filters.sortNewest') },
  { value: 'priceAsc',    label: t('filters.sortPriceAsc') },
  { value: 'priceDesc',   label: t('filters.sortPriceDesc') },
  { value: 'yearAsc',     label: t('filters.sortYearAsc') },
  { value: 'yearDesc',    label: t('filters.sortYearDesc') },
];

export interface YachtListFiltersProps {
  q: string;
  setQ: (v: string) => void;

  // фильтр по категории (id в строке, '' = любая категория)
  categoryId: string;
  setCategoryId: (v: string) => void;

  minYear: string;
  setMinYear: (v: string) => void;

  maxYear: string;
  setMaxYear: (v: string) => void;

  minPrice: string;
  setMinPrice: (v: string) => void;

  maxPrice: string;
  setMaxPrice: (v: string) => void;

  sort: SortKey;
  setSort: (v: SortKey) => void;

  currentYear: number;

  onApply: (e: React.FormEvent) => void;
  onReset: () => void;
  onOpenCompetitorFilters?: () => void;
}

export default function YachtListFilters(props: YachtListFiltersProps) {
  const { t } = useTranslation('dashboard');

  // ✅ локальный список категорий для селекта
  const [categoryOptions, setCategoryOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  const {
    q, setQ,
    categoryId, setCategoryId,
    minYear, setMinYear,
    maxYear, setMaxYear,
    minPrice, setMinPrice,
    maxPrice, setMaxPrice,
    sort, setSort,
    currentYear,
    onApply, onReset,
    onOpenCompetitorFilters,
  } = props;

  // грузим список категорий (первые N штук) для селекта
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { items } = await findCategories('', 100);
        if (cancelled) return;
        const opts: Array<{ value: string; label: string }> = [
          {
            value: '',
            label: t('filters.anyCategory', 'Any category'),
          },
          ...items.map((c: CatalogCategory) => ({
            value: String(c.id),
            label: c.nameEn || c.nameRu || `#${c.id}`,
          })),
        ];
        setCategoryOptions(opts);
      } catch (e) {
        console.warn('[YachtListFilters] failed to load categories:', e);
        // хотя бы fallback "Any category"
        setCategoryOptions((prev) =>
          prev.length
            ? prev
            : [{ value: '', label: t('filters.anyCategory', 'Any category') }],
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <form onSubmit={onApply} className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-6">
      <input
        className="rounded border p-2 md:col-span-2"
        placeholder={t('filters.searchPlaceholder', 'Search (name, model, location, owner)…')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <select
        className="rounded border p-2"
        value={sort}
        onChange={(e) => setSort(e.target.value as SortKey)}
      >
        {SORT_OPTIONS(t).map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        className="rounded border p-2"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
      >
        {categoryOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <input
        className="rounded border p-2"
        placeholder={t('filters.minYear', 'Min year (≤ {{year}})', { year: currentYear })}
        inputMode="numeric"
        value={minYear}
        onChange={(e) => setMinYear(e.target.value)}
      />
      <input
        className="rounded border p-2"
        placeholder={t('filters.maxYear', 'Max year (≤ {{year}})', { year: currentYear })}
        inputMode="numeric"
        value={maxYear}
        onChange={(e) => setMaxYear(e.target.value)}
      />

      <input
        className="rounded border p-2"
        placeholder={t('filters.minPrice', 'Min price')}
        inputMode="numeric"
        value={minPrice}
        onChange={(e) => setMinPrice(e.target.value)}
      />
      <input
        className="rounded border p-2"
        placeholder={t('filters.maxPrice', 'Max price')}
        inputMode="numeric"
        value={maxPrice}
        onChange={(e) => setMaxPrice(e.target.value)}
      />

      <button
        type="submit"
        className="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-900 md:col-span-1"
      >
        {t('filters.apply', 'Apply')}
      </button>

      <button
        type="button"
        onClick={onReset}
        className="rounded bg-gray-300 px-4 py-2 text-black hover:bg-gray-400 md:col-span-1"
      >
        {t('filters.reset', 'Reset')}
      </button>

      <button
        type="button"
        onClick={onOpenCompetitorFilters}
        className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 md:col-span-1"
      >
        {t('filters.competitorFilters', 'Competitors filter')}
      </button>
    </form>
  );
}