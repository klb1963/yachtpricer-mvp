import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listYachts } from '../api';
import type { Yacht, YachtListParams, YachtListResponse } from '../api';

const TYPE_OPTIONS = ['', 'monohull', 'catamaran', 'trimaran', 'compromis'] as const;
const SORT_OPTIONS = [
  { value: 'createdDesc', label: 'Newest' },
  { value: 'priceAsc', label: 'Price ↑' },
  { value: 'priceDesc', label: 'Price ↓' },
  { value: 'yearAsc', label: 'Year ↑' },
  { value: 'yearDesc', label: 'Year ↓' },
] as const;

const CURRENT_YEAR = new Date().getFullYear();

export default function DashboardPage() {
  // --- черновики фильтров (то, что в инпутах) ---
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>('');
  const [minYear, setMinYear] = useState<string>('');
  const [maxYear, setMaxYear] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  // сортировка/страницы – управляем отдельно
  const [sort, setSort] =
    useState<'priceAsc' | 'priceDesc' | 'yearAsc' | 'yearDesc' | 'createdDesc'>('createdDesc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // --- применённые параметры запроса (только они триггерят загрузку) ---
  const [query, setQuery] = useState<YachtListParams>({ sort: 'createdDesc', page: 1, pageSize: 10 });

  // данные
  const [items, setItems] = useState<Yacht[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // загрузка только при изменении query
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    listYachts(query)
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
    return () => { cancelled = true; };
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(total / (query.pageSize ?? pageSize)));

  // Применить фильтры
  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const next: YachtListParams = {
      q: q || undefined,
      type: type || undefined,
      minYear: minYear ? Number(minYear) : undefined,
      maxYear: maxYear ? Number(maxYear) : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sort,
      page: 1,                // при смене фильтров всегда на первую
      pageSize,
    };
    setPage(1);
    setQuery(next);
  }

  // Сбросить
  function resetFilters() {
    setQ('');
    setType('');
    setMinYear('');
    setMaxYear('');
    setMinPrice('');
    setMaxPrice('');
    setSort('createdDesc');
    setPage(1);
    setPageSize(10);
    setQuery({ sort: 'createdDesc', page: 1, pageSize: 10 });
  }

  // Пагинация и сортировка меняют query без трогания черновиков
  function goPrev() {
    const p = Math.max(1, (query.page ?? 1) - 1);
    setPage(p);
    setQuery({ ...query, page: p });
  }
  function goNext() {
    const p = Math.min(totalPages, (query.page ?? 1) + 1);
    setPage(p);
    setQuery({ ...query, page: p });
  }
  function changePageSize(n: number) {
    setPageSize(n);
    setPage(1);
    setQuery({ ...query, pageSize: n, page: 1 });
  }
  function changeSort(v: typeof sort) {
    setSort(v);
    setQuery({ ...query, sort: v });
  }
  function changeType(val: string) {
    setType(val);
    setPage(1);
    setQuery({ ...query, type: val || undefined, page: 1 });
  }
  // Мэппинг кликов по колонкам в значения бэкенда
  function toggleSortBy(col: 'year' | 'price') {
    setPage(1); // при смене сортировки — на первую страницу
    setSort((prev) => {
      if (col === 'year') {
        return prev === 'yearAsc' ? 'yearDesc' : 'yearAsc';
      }
      // col === 'price'
      return prev === 'priceAsc' ? 'priceDesc' : 'priceAsc';
    });
  }

  // для стрелочек в UI
  function sortArrow(col: 'year' | 'price') {
    if ((col === 'year' && (sort === 'yearAsc' || sort === 'yearDesc')) ||
      (col === 'price' && (sort === 'priceAsc' || sort === 'priceDesc'))) {
      const dir = sort.endsWith('Asc') ? '↑' : '↓';
      return <span className="ml-1 text-gray-500">{dir}</span>;
    }
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-3xl font-bold">List:</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Sort:&nbsp;</label>
          <select
            className="rounded border p-2"
            value={sort}
            onChange={(e) => changeSort(e.target.value as typeof sort)}
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}> {s.label} </option>
            ))}
          </select>

          {/* Кнопка Add */}
          <Link
            to="/yacht/new"
            className="rounded bg-blue-600 px-3 py-2 hover:bg-blue-700"
          >
            <span className="text-white font-bold">+ Add</span>
          </Link>

        </div>
      </div>

      {/* Фильтры */}
      <form onSubmit={applyFilters} className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-6">
        <input
          className="rounded border p-2 md:col-span-2"
          placeholder="Search (name/model/location/owner)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded border p-2"
          value={type}
          onChange={(e) => changeType(e.target.value)}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t ? `Type: ${t}` : 'Any type'}</option>
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
        <div className="flex gap-2 md:col-span-1">

          {/* Кнопка Apply */}
          <button
            type="submit"
            className="rounded bg-gray-800 px-4 py-2 hover:bg-gray-900"
          >
            <span className="text-white font-bold">Apply</span>
          </button>

          <button type="button" onClick={resetFilters} className="rounded border px-4 py-2">
            Reset
          </button>

        </div>
      </form>

      {/* Таблица/лоадер/ошибка — инпуты остаются в DOM, фокусы не теряются */}
      {err ? (
        <div className="mt-10 text-center text-red-600">{err}</div>
      ) : loading ? (
        <div className="mt-10 text-center">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="[&>th]:px-4 [&>th]:py-2 text-left">
                <th>Name</th>
                <th>Model</th>
                <th>Type</th>
                <th>Length</th>

                {/* Year — кликабельно */}
                <th
                  className="cursor-pointer hover:underline"
                  onClick={() => toggleSortBy('year')}
                  title="Sort by year"
                >
                  Year {sortArrow('year')}
                </th>

                <th>Location</th>

                {/* Price (base) — кликабельно */}
                <th
                  className="cursor-pointer hover:underline"
                  onClick={() => toggleSortBy('price')}
                  title="Sort by price"
                >
                  Price (base) {sortArrow('price')}
                </th>

                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {items.map((y) => (
                <tr key={y.id} className="border-top [&>td]:px-4 [&>td]:py-2">
                  <td>
                    <Link className="text-blue-600 hover:underline" to={`/yacht/${y.id}`}>
                      {y.name}
                    </Link>
                  </td>
                  <td>{y.manufacturer} {y.model}</td>
                  <td>{y.type}</td>
                  <td>{y.length} m</td>
                  <td>{y.builtYear}</td>
                  <td>{y.location}</td>
                  <td>{typeof y.basePrice === 'string' ? y.basePrice : String(y.basePrice)}</td>
                  <td>{y.ownerName ?? '—'}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">No results</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Пагинация */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Total: {total} • Page {query.page ?? page} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} disabled={(query.page ?? 1) <= 1} className="rounded border px-3 py-1 disabled:opacity-50">
            ← Prev
          </button>
          <select
            className="rounded border px-2 py-1"
            value={query.pageSize ?? pageSize}
            onChange={(e) => changePageSize(Number(e.target.value))}
          >
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <button
            onClick={goNext}
            disabled={(query.page ?? 1) >= totalPages}
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
