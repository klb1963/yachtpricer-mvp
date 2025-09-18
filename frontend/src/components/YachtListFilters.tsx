// /frontend/src/components/YachtListFilters.tsx

import React from 'react';
import type { YachtType } from '@/types/yacht';

type SortKey = 'createdDesc' | 'priceAsc' | 'priceDesc' | 'yearAsc' | 'yearDesc';

const TYPE_OPTIONS = [
  { value: '',           label: 'Any type' },
  { value: 'monohull',   label: 'Monohull' },
  { value: 'catamaran',  label: 'Catamaran' },
  { value: 'trimaran',   label: 'Trimaran' },
  { value: 'compromis',  label: 'Compromis' },
] as const;

const SORT_OPTIONS = [
  { value: 'createdDesc', label: 'Newest' },
  { value: 'priceAsc',    label: 'Price ↑' },
  { value: 'priceDesc',   label: 'Price ↓' },
  { value: 'yearAsc',     label: 'Year ↑' },
  { value: 'yearDesc',    label: 'Year ↓' },
] as const;

export interface YachtListFiltersProps {
  q: string;
  setQ: (v: string) => void;

  type: YachtType | '';
  setType: (v: YachtType | '') => void;

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
  const {
    q, setQ,
    type, setType,
    minYear, setMinYear,
    maxYear, setMaxYear,
    minPrice, setMinPrice,
    maxPrice, setMaxPrice,
    sort, setSort,
    currentYear,
    onApply, onReset,
    onOpenCompetitorFilters,
  } = props;

  return (
    <form onSubmit={onApply} className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-6">
      <input
        className="rounded border p-2 md:col-span-2"
        placeholder="Search (name, model, location, owner)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <select
        className="rounded border p-2"
        value={sort}
        onChange={(e) => setSort(e.target.value as SortKey)}
      >
        {SORT_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            Sort: {s.label}
          </option>
        ))}
      </select>

      <select
        className="rounded border p-2"
        value={type}
        onChange={(e) => setType((e.target.value as YachtType) || '')}
      >
        {TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <input
        className="rounded border p-2"
        placeholder={`Min year (≤ ${currentYear})`}
        inputMode="numeric"
        value={minYear}
        onChange={(e) => setMinYear(e.target.value)}
      />
      <input
        className="rounded border p-2"
        placeholder={`Max year (≤ ${currentYear})`}
        inputMode="numeric"
        value={maxYear}
        onChange={(e) => setMaxYear(e.target.value)}
      />

      <input
        className="rounded border p-2"
        placeholder="Min price"
        inputMode="numeric"
        value={minPrice}
        onChange={(e) => setMinPrice(e.target.value)}
      />
      <input
        className="rounded border p-2"
        placeholder="Max price"
        inputMode="numeric"
        value={maxPrice}
        onChange={(e) => setMaxPrice(e.target.value)}
      />

      <button
        type="submit"
        className="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-900 md:col-span-1"
      >
        Apply
      </button>

      <button
        type="button"
        onClick={onReset}
        className="rounded bg-gray-300 px-4 py-2 text-black hover:bg-gray-400 md:col-span-1"
      >
        Reset
      </button>

      <button
        type="button"
        onClick={onOpenCompetitorFilters}
        className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 md:col-span-1"
      >
        Competitors filter
      </button>
    </form>
  );
}