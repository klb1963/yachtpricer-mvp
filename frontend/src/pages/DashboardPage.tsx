// frontend/src/pages/DashboardPage.tsx

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Yacht, YachtListParams, YachtListResponse } from '../api';
import { listYachts } from '../api';
import YachtCard from '../components/YachtCard';

// Значения value должны совпадать с тем, как хранится в БД (см. backend):
//  - "Sailing yacht" — монокорпус (Monohull)
//  - "Catamaran"
//  - (опционально) другие типы, если появятся в БД
const TYPE_OPTIONS = [
    { value: '',              label: 'Any type' },
    { value: 'Sailing yacht', label: 'Monohull' },
    { value: 'Catamaran',     label: 'Catamaran' },
    { value: 'Trimaran',      label: 'Trimaran' },
    { value: 'Compromis',     label: 'Compromis' },
  ] as const;

const SORT_OPTIONS = [
  { value: 'createdDesc', label: 'Newest' },
  { value: 'priceAsc', label: 'Price ↑' },
  { value: 'priceDesc', label: 'Price ↓' },
  { value: 'yearAsc', label: 'Year ↑' },
  { value: 'yearDesc', label: 'Year ↓' },
] as const;

const CURRENT_YEAR = new Date().getFullYear();

const useViewMode = () => {
  const loc = useLocation();
  const nav = useNavigate();

  const initial =
    (new URLSearchParams(loc.search).get('view') as 'cards' | 'table' | null) ||
    (localStorage.getItem('dashboard:view') as 'cards' | 'table' | null) ||
    'table';

  const [view, setView] = useState<'cards' | 'table'>(initial);

  // Синхроним URL и LS
  useEffect(() => {
    localStorage.setItem('dashboard:view', view);
    const sp = new URLSearchParams(loc.search);
    sp.set('view', view);
    nav({ pathname: '/dashboard', search: sp.toString() }, { replace: true });
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  return { view, setView };
};

export default function DashboardPage() {

  const { view, setView } = useViewMode();
  const location = useLocation();

  // фильтры/сортировка/пагинация
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>('');
  const [minYear, setMinYear] = useState<string>('');
  const [maxYear, setMaxYear] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sort, setSort] =
    useState<'priceAsc' | 'priceDesc' | 'yearAsc' | 'yearDesc' | 'createdDesc'>('createdDesc');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [items, setItems] = useState<Yacht[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const params: YachtListParams = useMemo(
    () => ({
      q: q || undefined,
      type: type || undefined,
      minYear: minYear ? Number(minYear) : undefined,
      maxYear: maxYear ? Number(maxYear) : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sort,
      page,
      pageSize,
    }),
    [q, type, minYear, maxYear, minPrice, maxPrice, sort, page, pageSize],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    listYachts(params)
      .then((res: YachtListResponse) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));
  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  // сорт по клику на заголовок (как сделали ранее — оставляю)
  const onSortBy = (field: 'price' | 'year') => {
    setSort((prev) => {
      if (field === 'price') return prev === 'priceAsc' ? 'priceDesc' : 'priceAsc';
      return prev === 'yearAsc' ? 'yearDesc' : 'yearAsc';
    });
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Boats</h1>

        {/* Переключатель вида */}
        <div className="flex items-center gap-2">

          <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setView('table')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === 'table'
                  ? 'bg-gray-900 text-white'
                  : '!text-gray-800 hover:bg-gray-100'   // <- добавили !text-gray-800
                }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setView('cards')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === 'cards'
                  ? 'bg-gray-900 text-white'
                  : '!text-gray-800 hover:bg-gray-100'   // <- добавили !text-gray-800
                }`}
            >
              Cards
            </button>
          </div>

          <Link
            to="/yacht/new"
            className="rounded bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700"
          >
            + Add
          </Link>
        </div>
      </div>

      {/* Фильтры */}
      <form onSubmit={applyFilters} className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-6">
        <input
          className="rounded border p-2 md:col-span-2"
          placeholder="Search (name, model, location, owner)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select
          className="rounded border p-2"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
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
          onChange={(e) => setType(e.target.value)}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <input
          className="rounded border p-2"
          placeholder={`Min year (≤ ${CURRENT_YEAR})`}
          inputMode="numeric"
          value={minYear}
          onChange={(e) => setMinYear(e.target.value)}
        />
        <input
          className="rounded border p-2"
          placeholder={`Max year (≤ ${CURRENT_YEAR})`}
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
      </form>

      {/* Контент: таблица или карточки */}
      {loading ? (
        <div className="mt-10 text-center">Loading…</div>
      ) : err ? (
        <div className="mt-10 text-center text-red-600">{err}</div>
      ) : view === 'cards' ? (
        // ✨ Карточная сетка: от 1 до 5 колонок
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((y) => (
           <YachtCard key={y.id} y={y} search={location.search} /> 
          ))}
          {items.length === 0 && (
            <div className="col-span-full py-10 text-center text-gray-500">No results</div>
          )}
        </div>
      ) : (
        // Таблица (как было), с кликом по заголовкам для сортировки части полей
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="[&>th]:px-4 [&>th]:py-2 text-left">
                <th>Name</th>
                <th>Model</th>
                <th>Type</th>
                <th>Length</th>
                <th>
                  <button
                    type="button"
                    onClick={() => onSortBy('year')}
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-gray-100"
                    title="Sort by year"
                  >
                    Year
                    <span className="text-gray-400">
                      {sort === 'yearAsc' ? '↑' : sort === 'yearDesc' ? '↓' : ''}
                    </span>
                  </button>
                </th>
                <th>Location</th>
                <th>
                  <button
                    type="button"
                    onClick={() => onSortBy('price')}
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-gray-100"
                    title="Sort by price"
                  >
                    Price (base)
                    <span className="text-gray-400">
                      {sort === 'priceAsc' ? '↑' : sort === 'priceDesc' ? '↓' : ''}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-2 text-left">Owner</th>
              </tr>
            </thead>
            <tbody>
                    {items.map((y) => (
                      <tr key={y.id} className="border-t [&>td]:px-4 [&>td]:py-2">
                        <td>

                          <Link
                            className="text-blue-600 hover:underline"
                            to={{ pathname: `/yacht/${y.id}`, search: location.search }}
                          >

                            {y.name}
                          </Link>
                        </td>
                  <td>
                    {y.manufacturer} {y.model}
                  </td>
                  <td>{y.type}</td>
                  <td>{y.length} m</td>
                  <td>{y.builtYear}</td>
                  <td>{y.location}</td>
                  <td>
                    {typeof y.basePrice === 'string'
                      ? y.basePrice
                      : Number.isFinite(y.basePrice)
                      ? String(Math.round(Number(y.basePrice)))
                      : '—'}
                  </td>
                  <td className="px-4 py-2">{y.ownerName ?? '—'}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    No results
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Пагинация */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Total: {total} • Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={page <= 1}
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            ← Prev
          </button>
          <select
            className="rounded border px-2 py-1"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
          <button
            onClick={goNext}
            disabled={page >= totalPages}
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
