// /frontend/src/pages/DashboardPage.tsx

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Yacht, YachtListParams, YachtListResponse } from '../api';
import { parseISO } from 'date-fns';
import { listYachts } from '../api';
import YachtCard from '../components/YachtCard';
import { weekIso } from '../utils/date';
import WeekPicker from '../components/WeekPicker';
import YachtListFilters from '@/components/YachtListFilters';
import YachtTable from '../components/YachtTable';
import Modal from '@/components/Modal';
import CompetitorFiltersPage from '@/pages/CompetitorFiltersPage';
import { HeaderWithSourceBadge } from "../components/HeaderWithSourceBadge";


import {
  startScrape,
  getScrapeStatus,
  aggregateSnapshot,
  listCompetitorPrices,
  upsertCompetitorFilters,
} from '../api';

import type { CompetitorPrice, StartResponseDto, ScrapeSource, CompetitorFiltersDto, } from '../api';
import { useTranslation } from 'react-i18next';

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
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');

  // читаем неделю из URL (если валидна), иначе текущая
  const initWeekFromUrl = () => {
    const w = new URLSearchParams(location.search).get('week');
    if (!w) return weekIso();
    try {
      const d = parseISO(w);
      return Number.isNaN(d.getTime()) ? weekIso() : w;
    } catch {
      return weekIso();
    }
  };
  const [weekStart, setWeekStart] = useState<string>(initWeekFromUrl());

  // источник скана (persisted + синхронизация с URL), используем тип из api.ts
  const initSource = (): ScrapeSource => {
    const fromUrl = new URLSearchParams(location.search).get('source');
    const fromLs = localStorage.getItem('competitor:scanSource');
    if (fromUrl === 'INNERDB' || fromUrl === 'NAUSYS') return fromUrl as ScrapeSource;
    if (fromLs === 'INNERDB' || fromLs === 'NAUSYS') return fromLs as ScrapeSource;
    return 'INNERDB';
  };
  const [scanSource, setScanSource] = useState<ScrapeSource>(initSource());

  // ← NEW: если кто-то (модалка) поменял ?source= в URL, подтягиваем это в state
  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get('source');
    if (fromUrl === 'INNERDB' || fromUrl === 'NAUSYS') {
      setScanSource((prev) => (prev !== fromUrl ? (fromUrl as ScrapeSource) : prev));
    }
  }, [location.search]);  

  useEffect(() => {
    localStorage.setItem('competitor:scanSource', scanSource);
    const sp = new URLSearchParams(location.search);
    sp.set('source', scanSource);
    sp.set('view', view);
    navigate({ pathname: '/dashboard', search: sp.toString() }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanSource]);

  // держим week в URL синхронно с выбором недели
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    sp.set('view', view);
    sp.set('source', scanSource);
    sp.set('week', weekStart);
    navigate({ pathname: '/dashboard', search: sp.toString() }, { replace: true });
  }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // фильтры/сортировка/пагинация
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
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
      categoryId: categoryId ? Number(categoryId) : undefined,
      minYear: minYear ? Number(minYear) : undefined,
      maxYear: maxYear ? Number(maxYear) : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sort,
      page,
      pageSize,
      // 🔹 неделя, для которой хотим подтянуть basePrice из WeekSlot
      weekStart,
    }),
    [q, categoryId, minYear, maxYear, minPrice, maxPrice, sort, page, pageSize, weekStart],
  );

  // модалка фильтров конкуренток
  const [isCompFiltersOpen, setCompFiltersOpen] = useState(false);
  
  // активный фильтр конкуренток (id сохраняем в localStorage)
  const [activeFilterId, setActiveFilterId] = useState<string | null>(
    localStorage.getItem('competitor:activeFilterId')
  );

  useEffect(() => {
    if (activeFilterId) {
      localStorage.setItem('competitor:activeFilterId', activeFilterId);
    }
  }, [activeFilterId]);

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

  // Сбрасываем результаты скана при смене недели ИЛИ источника
  useEffect(() => {
    setAggByYacht({});
    setRawByYacht({});
    setRowsOpen({});
    setLastWarningByYacht({});
  }, [weekStart, scanSource]);

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
  const [rawByYacht, setRawByYacht] = useState<
    Record<string, { prices: CompetitorPrice[]; source: ScrapeSource }>
  >({})

  // предупреждение от бэкенда: «нет конкурентов, причины …»
  const [lastWarningByYacht, setLastWarningByYacht] = useState<Record<string, string | null>>({});

  async function handleScan(y: Yacht) {
    try {
      // 0) Мгновенно очищаем детали по этой лодке для текущего источника,
      //    чтобы старые (например, INNERDB) не «подсвечивались» под NAUSYS
      setRawByYacht((prev) => ({
        ...prev,
        [y.id]: { prices: [], source: scanSource },
      }));
      setRowsOpen((prev) => ({ ...prev, [y.id]: false }));
        if (scanSource === 'NAUSYS' && !activeFilterId) {
        alert('Please set and save Competitor filters first.');
        setCompFiltersOpen(true);
        return;
      }
      setBusyId(y.id)
      const week = weekStart || new Date().toISOString().slice(0, 10) // YYYY-MM-DD

      const startRes: StartResponseDto = await startScrape({
        yachtId: y.id,
        weekStart: week,
        source: scanSource,                                  // ← теперь тип совпадает
        filterId: scanSource === 'NAUSYS' ? (activeFilterId ?? undefined) : undefined,
      })
      const { jobId } = startRes

      let status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' = 'PENDING'
      for (let i = 0; i < 30; i++) {
        const { status: s } = await getScrapeStatus(jobId)
        status = s
        if (status === 'DONE' || status === 'FAILED') break
        await new Promise((res) => setTimeout(res, 500))
      }
      if (status !== 'DONE') throw new Error(`Scrape status: ${status}`)

      // если бэк сразу вернул, что никого не оставили — сохраним читаемую строку причин
      if (startRes.kept === 0) {
        const text =
          startRes.reasons && startRes.reasons.length > 0
            ? `No competitors found. Reasons: ${startRes.reasons.join(' | ')}`
            : 'No competitors matched filters'
        setLastWarningByYacht((prev) => ({ ...prev, [y.id]: text }))
      } else {
        // очистим прошлые предупреждения при успешном результате
        setLastWarningByYacht((prev) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [y.id]: _omit, ...rest } = prev
          return rest
        })
      }

      const snap = await aggregateSnapshot({ yachtId: y.id, week, source: scanSource })
      if (snap) {
        setAggByYacht((prev) => ({
          ...prev,
          [y.id]: {
            top1: snap.top1Price,
            avg: snap.top3Avg,
            cur: snap.currency,
            n: snap.sampleSize,
          },
        }))
      }

      const raw = await listCompetitorPrices({ yachtId: y.id, week, source: scanSource })
      setRawByYacht((prev) => ({ ...prev, [y.id]: { prices: raw, source: scanSource } }))
      // раскрываем строку/карточку в любом случае — даже если пусто, покажем предупреждение
      setRowsOpen((prev) => ({ ...prev, [y.id]: true }))
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setBusyId(null)
    }
  }

  // принимаем значения из формы конкурентных фильтров
  const handleCompetitorFiltersSubmit = async (filters: CompetitorFiltersDto, selectedSource?: ScrapeSource) => {
    try {
      const { id } = await upsertCompetitorFilters(filters);
      setActiveFilterId(id);
      console.log('✅ Competitor filters saved. Active filter id =', id);
      if (selectedSource) setScanSource(selectedSource);
    } catch (e) {
      console.error('Failed to save competitor filters', e);
      alert('Failed to save competitor filters');
    } finally {
      setCompFiltersOpen(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6">

      <div className="mb-4">
        <h1 className="text-3xl font-bold mb-2">
          {t('title', 'Boats')}
        </h1>

        <div className="flex items-center justify-between">
          <WeekPicker value={weekStart} onChange={setWeekStart} />
          <HeaderWithSourceBadge />
        </div>

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
              {t('view.table', 'Table')}
            </button>
            <button
              type="button"
              onClick={() => setView('cards')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === 'cards' ? 'bg-gray-900 text-white' : '!text-gray-800 hover:bg-gray-100'
              }`}
            >
              {t('view.cards', 'Cards')}
            </button>
          </div>

          <Link
            to="/yacht/new"
            className="rounded bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700"
          >
            {t('actions.add', '+ Add')}
          </Link>
        </div>
      </div>

      {/* Фильтры */}
      <YachtListFilters
        q={q} setQ={setQ}
        categoryId={categoryId} setCategoryId={setCategoryId} 
        minYear={minYear} setMinYear={setMinYear}
        maxYear={maxYear} setMaxYear={setMaxYear}
        minPrice={minPrice} setMinPrice={setMinPrice}
        maxPrice={maxPrice} setMaxPrice={setMaxPrice}
        sort={sort} setSort={setSort}
        currentYear={CURRENT_YEAR}
        onApply={applyFilters}
        onReset={() => {
          setQ('');
          setCategoryId('');
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
              key={`${scanSource}-${y.id}`} // (необязательно, но помогает избежать "залипания")
              y={y}
              search={location.search}
              onScan={() => handleScan(y)}
              scanning={busyId === y.id}
              agg={aggByYacht[y.id]}
              details={rawByYacht[y.id]?.prices ?? []}
              warning={lastWarningByYacht[y.id] ?? null}
              open={!!rowsOpen[y.id]}
              onToggleDetails={() => setRowsOpen((p) => ({ ...p, [y.id]: !p[y.id] }))}
              scanSource={scanSource}
            />
          ))}
          {items.length === 0 && (
            <div className="col-span-full py-10 text-center text-gray-500">No results</div>
          )}
        </div>
      ) : (
        <YachtTable
          key={`table-${scanSource}-${weekStart}`}
          items={items}
          locationSearch={location.search}
          sort={sort}
          onSortBy={onSortBy}
          busyId={busyId}
          aggByYacht={aggByYacht}
          rawByYacht={rawByYacht}
          lastWarningByYacht={lastWarningByYacht}
          rowsOpen={rowsOpen}
          onScan={handleScan}
          onToggleDetails={(id) => setRowsOpen((p) => ({ ...p, [id]: !p[id] }))}
          scanSource={scanSource}
        />
      )}

      {/* Пагинация */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Total: {total} • Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} disabled={page <= 1} className="rounded border px-3 py-1 disabled:opacity-50">
            ←
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
            →
          </button>
        </div>
      </div>
      {/* Модалка конкурентных фильтров */}
      <Modal
        open={isCompFiltersOpen}
        onClose={() => setCompFiltersOpen(false)}
        // title="Competitor filters"
      >
        <CompetitorFiltersPage
          onSubmit={handleCompetitorFiltersSubmit}
          onClose={() => setCompFiltersOpen(false)}
        />
      </Modal>
    </div>
  );
}