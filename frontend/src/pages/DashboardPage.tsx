// /frontend/src/pages/DashboardPage.tsx

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Yacht, YachtListParams, YachtListResponse } from '../api';
import { listYachts } from '../api';
import YachtCard from '../components/YachtCard';
import type { YachtType } from '../types/yacht';
import { weekIso } from '../utils/date';
import WeekPicker from '../components/WeekPicker';

// API скрапера и типы
import {
  startScrape,
  getScrapeStatus,
  aggregateSnapshot,
  listCompetitorPrices,
} from '../api';
import type { CompetitorPrice } from '../api';

// Значения value должны совпадать с тем, как хранится в БД (см. backend)
const TYPE_OPTIONS = [
  { value: '',           label: 'Any type' },
  { value: 'monohull',   label: 'Monohull' },
  { value: 'catamaran',  label: 'Catamaran' },
  { value: 'trimaran',   label: 'Trimaran' },
  { value: 'compromis',  label: 'Compromis' },
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
  const [weekStart, setWeekStart] = useState<string>(weekIso());

  // фильтры/сортировка/пагинация
  const [q, setQ] = useState('');
  const [type, setType] = useState<YachtType | ''>('');
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

  // сорт по клику на заголовок
  const onSortBy = (field: 'price' | 'year') => {
    setSort((prev) => {
      if (field === 'price') return prev === 'priceAsc' ? 'priceDesc' : 'priceAsc';
      return prev === 'yearAsc' ? 'yearDesc' : 'yearAsc';
    });
    setPage(1);
  };

  // ============================
  // состояние и логика сканера
  // ============================
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aggByYacht, setAggByYacht] = useState<Record<string, { top1: string; avg: string; cur: string; n: number }>>({});
  const [rowsOpen, setRowsOpen] = useState<Record<string, boolean>>({});
  const [rawByYacht, setRawByYacht] = useState<Record<string, { prices: CompetitorPrice[] }>>({});

  async function handleScan(y: Yacht) {
    try {
      setBusyId(y.id);
      // Берём выбранную неделю из WeekPicker (UTC ISO yyyy-mm-dd)
      const week = weekStart;

      // 1) старт мок-скрапера
      const { jobId } = await startScrape({ yachtId: y.id, weekStart: week, source: 'BOATAROUND' });

      // 2) поллинг статуса (до ~15 секунд)
      let status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' = 'PENDING';
      for (let i = 0; i < 30; i++) {
        const { status: s } = await getScrapeStatus(jobId);
        status = s;
        if (status === 'DONE' || status === 'FAILED') break;
        await new Promise((res) => setTimeout(res, 500));
      }
      if (status !== 'DONE') throw new Error(`Scrape status: ${status}`);

      // 3) агрегаты
      const snap = await aggregateSnapshot({ yachtId: y.id, week, source: 'BOATAROUND' });
      if (snap) {
        setAggByYacht((prev) => ({
          ...prev,
          [y.id]: { top1: snap.top1Price, avg: snap.top3Avg, cur: snap.currency, n: snap.sampleSize },
        }));
      }

      // 4) сырые карточки конкурентов — для Details
      const raw = await listCompetitorPrices({ yachtId: y.id, week });
      setRawByYacht((prev) => ({ ...prev, [y.id]: { prices: raw } }));
      setRowsOpen((prev) => ({ ...prev, [y.id]: true }));
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-4">
        <h1 className="text-3xl font-bold mb-2">Boats</h1>
        <WeekPicker value={weekStart} onChange={setWeekStart} />

        {/* Переключатель вида и Add+ */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setView('table')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === 'table'
                  ? 'bg-gray-900 text-white'
                  : '!text-gray-800 hover:bg-gray-100'
                }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setView('cards')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === 'cards'
                  ? 'bg-gray-900 text-white'
                  : '!text-gray-800 hover:bg-gray-100'
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
          onChange={(e) =>
            setType((e.target.value as YachtType) || '')
          }
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

        <button
          type="button"
          onClick={() => {
            setQ('');
            setType('');
            setMinYear('');
            setMaxYear('');
            setMinPrice('');
            setMaxPrice('');
            setSort('createdDesc');
            setPage(1);
          }}
          className="rounded bg-gray-300 px-4 py-2 text-black hover:bg-gray-400 md:col-span-1"
        >
          Reset
        </button>
      </form>

      {/* Контент: таблица или карточки */}
      {loading ? (
        <div className="mt-10 text-center">Loading…</div>
      ) : err ? (
        <div className="mt-10 text-center text-red-600">{err}</div>
      ) : view === 'cards' ? (
            // ✨ Карточная сетка (добавили кнопку Scan на карточки)
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
              {items.map((y) => (
                <YachtCard
                  key={y.id}
                  y={y}
                  search={location.search}
                  onScan={() => handleScan(y)}
                  scanning={busyId === y.id}
                  agg={aggByYacht[y.id]}
                  details={rawByYacht[y.id]?.prices ?? []}
                  open={!!rowsOpen[y.id]}
                  onToggleDetails={() =>
                    setRowsOpen((p) => ({ ...p, [y.id]: !p[y.id] }))
                  }
                />
              ))}
          {items.length === 0 && (
            <div className="col-span-full py-10 text-center text-gray-500">No results</div>
          )}
        </div>
      ) : (
        // Таблица
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:font-semibold [&>th]:text-gray-800 text-left">
                <th>Name</th>
                <th>Model</th>
                <th>Type</th>
                <th>Length</th>
                <th>
                  <button
                    type="button"
                    onClick={() => onSortBy('year')}
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 !text-gray-900 hover:!text-gray-900 hover:bg-gray-100"
                    title="Sort by year"
                  >
                    Year
                    <span
                      className={
                        sort.startsWith('year')
                          ? 'text-blue-600 font-bold'
                          : 'text-gray-400'
                      }
                    >
                      {sort === 'yearAsc' ? '↑' : sort === 'yearDesc' ? '↓' : ''}
                    </span>
                  </button>
                </th>
                <th>Location</th>
                <th>
                  <button
                    type="button"
                    onClick={() => onSortBy('price')}
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 !text-gray-900 hover:!text-gray-900 hover:bg-gray-100"
                    title="Sort by price"
                  >
                    Price (base)
                    <span
                      className={
                        sort.startsWith('price')
                          ? 'text-blue-600 font-bold'
                          : 'text-gray-400'
                      }
                    >
                      {sort === 'priceAsc' ? '↑' : sort === 'priceDesc' ? '↓' : ''}
                    </span>
                  </button>
                </th>

                {/* добавили колонку Competitors */}
                <th>Competitors</th>

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

                  {/* ячейка Competitors */}
                  <td className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleScan(y)}
                        disabled={busyId === y.id}
                        className={`rounded px-3 py-1 text-sm font-medium ${
                          busyId === y.id
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                        title="Fetch competitors and aggregate"
                      >
                        {busyId === y.id ? 'Scanning…' : 'Scan'}
                      </button>

                      {aggByYacht[y.id] ? (
                        <span className="text-xs text-gray-800">
                          TOP1: <b>{aggByYacht[y.id].top1} {aggByYacht[y.id].cur}</b>,&nbsp;
                          AVG(Top3): <b>{aggByYacht[y.id].avg}</b>&nbsp;({aggByYacht[y.id].n})
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}

                      {rawByYacht[y.id]?.prices?.length ? (
                        <button
                          type="button"
                          onClick={() =>
                            setRowsOpen((p) => ({ ...p, [y.id]: !p[y.id] }))
                          }
                          className="rounded border px-1.5 py-0.5 text-xs hover:bg-gray-100"
                          title="Show raw competitor cards"
                        >
                          {rowsOpen[y.id] ? 'Hide' : 'Details'}
                        </button>
                      ) : null}
                    </div>

                    {rowsOpen[y.id] && rawByYacht[y.id]?.prices ? (
                      <div className="mt-2 rounded border p-2">
                        <div className="mb-1 text-[11px] text-gray-600">
                          {rawByYacht[y.id].prices.length} offers:
                        </div>
                        <ul className="max-h-40 space-y-1 overflow-auto pr-1">
                          {rawByYacht[y.id].prices.map((p) => (
                            <li key={p.id} className="flex justify-between gap-2 text-[11px]">
                              <span className="truncate">
                                {p.competitorYacht ?? '—'} {p.year ? `(${p.year})` : ''} · {p.marina ?? '—'}
                                {p.cabins != null ? ` · ${p.cabins}c` : ''}{p.heads != null ? `/${p.heads}h` : ''}
                              </span>
                              <span className="shrink-0">{p.price} {p.currency ?? ''}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </td>

                  <td className="px-4 py-2">{y.ownerName ?? '—'}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-gray-500">
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