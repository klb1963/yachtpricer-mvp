// /frontend/src/pages/DashboardPage.tsx

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Yacht, YachtListParams, YachtListResponse } from '../api';
import { listYachts } from '../api';
import YachtCard from '../components/YachtCard';
import type { YachtType } from '../types/yacht';
import { weekIso } from '../utils/date';
import WeekPicker from '../components/WeekPicker';
import YachtListFilters from '@/components/YachtListFilters';
import YachtTable from '../components/YachtTable';
import Modal from '@/components/Modal';
import CompetitorFiltersPage from '@/pages/CompetitorFiltersPage';

import {
  startScrape,
  getScrapeStatus,
  aggregateSnapshot,
  listCompetitorPrices,
} from '../api';
import type { CompetitorPrice } from '../api';

const CURRENT_YEAR = new Date().getFullYear();

const useViewMode = () => {
  const loc = useLocation();
  const nav = useNavigate();

  const initial =
    (new URLSearchParams(loc.search).get('view') as 'cards' | 'table' | null) ||
    (localStorage.getItem('dashboard:view') as 'cards' | 'table' | null) ||
    'table';

  const [view, setView] = useState<'cards' | 'table'>(initial);

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

  // модалка фильтров конкуренток
  const [isCompFiltersOpen, setCompFiltersOpen] = useState(false);

  // загрузка списка яхт
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

  // cброс цен/агрегатов при смене недели
  useEffect(() => {
    setAggByYacht({});
    setRawByYacht({});
    setRowsOpen({});
  }, [weekStart]);

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
      const week = weekStart || new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      const { jobId } = await startScrape({ yachtId: y.id, weekStart: week, source: 'BOATAROUND' });

      let status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' = 'PENDING';
      for (let i = 0; i < 30; i++) {
        const { status: s } = await getScrapeStatus(jobId);
        status = s;
        if (status === 'DONE' || status === 'FAILED') break;
        await new Promise((res) => setTimeout(res, 500));
      }
      if (status !== 'DONE') throw new Error(`Scrape status: ${status}`);

      const snap = await aggregateSnapshot({ yachtId: y.id, week, source: 'BOATAROUND' });
      if (snap) {
        setAggByYacht((prev) => ({
          ...prev,
          [y.id]: { top1: snap.top1Price, avg: snap.top3Avg, cur: snap.currency, n: snap.sampleSize },
        }));
      }

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

  // принимаем значения из формы конкурентных фильтров
  const handleCompetitorFiltersSubmit = (filters: unknown) => {
    // TODO: сохранить глобально (например, localStorage) или отправить на бэкенд
    console.log('Competitor filters:', filters);
    setCompFiltersOpen(false);
  };

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
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === 'table' ? 'bg-gray-900 text-white' : '!text-gray-800 hover:bg-gray-100'
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setView('cards')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === 'cards' ? 'bg-gray-900 text-white' : '!text-gray-800 hover:bg-gray-100'
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
      <YachtListFilters
        q={q} setQ={setQ}
        type={type} setType={setType}
        minYear={minYear} setMinYear={setMinYear}
        maxYear={maxYear} setMaxYear={setMaxYear}
        minPrice={minPrice} setMinPrice={setMinPrice}
        maxPrice={maxPrice} setMaxPrice={setMaxPrice}
        sort={sort} setSort={setSort}
        currentYear={CURRENT_YEAR}
        onApply={applyFilters}
        onReset={() => {
          setQ('');
          setType('');
          setMinYear('');
          setMaxYear('');
          setMinPrice('');
          setMaxPrice('');
          setSort('createdDesc');
          setPage(1);
        }}
        onOpenCompetitorFilters={() => setCompFiltersOpen(true)} // ← ОТКРЫВАЕМ МОДАЛКУ
      />

      {/* Контент: таблица или карточки */}
      {loading ? (
        <div className="mt-10 text-center">Loading…</div>
      ) : err ? (
        <div className="mt-10 text-center text-red-600">{err}</div>
      ) : view === 'cards' ? (
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
              onToggleDetails={() => setRowsOpen((p) => ({ ...p, [y.id]: !p[y.id] }))}
            />
          ))}
          {items.length === 0 && (
            <div className="col-span-full py-10 text-center text-gray-500">No results</div>
          )}
        </div>
      ) : (
        <YachtTable
          items={items}
          locationSearch={location.search}
          sort={sort}
          onSortBy={onSortBy}
          busyId={busyId}
          aggByYacht={aggByYacht}
          rawByYacht={rawByYacht}
          rowsOpen={rowsOpen}
          onScan={handleScan}
          onToggleDetails={(id) => setRowsOpen((p) => ({ ...p, [id]: !p[id] }))}
        />
      )}

      {/* Пагинация */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Total: {total} • Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} disabled={page <= 1} className="rounded border px-3 py-1 disabled:opacity-50">
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
    {/* Модалка конкурентных фильтров */}
      <Modal
        open={isCompFiltersOpen}
        onClose={() => setCompFiltersOpen(false)}
        title="Competitor filters"
      >
        <CompetitorFiltersPage
          onSubmit={handleCompetitorFiltersSubmit}
          onCancel={() => setCompFiltersOpen(false)}
        />
      </Modal>
    </div>
  );
}