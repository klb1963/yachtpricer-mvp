// frontend/src/pages/YachtDetailsPage.tsx

import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { getYacht } from '../api';
import type { Yacht } from '../api';
import { PencilSquareIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

// ─ helpers (как на PricingPage) ─
function asMoney(
  n: number | string | null | undefined,
  currency: string | null | undefined = 'EUR',
) {
  if (n == null) return '—';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num as number)) return '—';
  const cur = currency || 'EUR';
  const symbol = cur === 'EUR' || cur === '€' ? '€' : cur;
  return `${symbol} ${(num as number).toLocaleString('en-EN', {
    maximumFractionDigits: 0,
  })}`;
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

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

type HistorySortKey = 'weekStart' | 'price' | 'discount' | 'date';

export default function YachtDetailsPage() {
  const { t, i18n } = useTranslation('yacht');
  const { id } = useParams();
  const [yacht, setYacht] = useState<Yacht | null>(null);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  // сортировка истории цен
  const [sortKey, setSortKey] = useState<HistorySortKey>('weekStart');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(key: HistorySortKey) {
    if (key === sortKey) {
      // повторный клик по той же колонке → инвертируем направление
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      // новая колонка → делаем её активной и ставим asc
      setSortKey(key);
      setSortDir('asc');
    }
  }

type CountryRef = { id: string; code2: string; name: string };
type CategoryRef = {
  id: number;
  nameEn?: string | null;
  nameRu?: string | null;
  nameHr?: string | null;
};
type BuilderRef = { id: number; name: string };

type ExtraService = { name: string; price: number };

type PriceListNodeItem = {
  weekStart: string; // ISO
  price: number;
  currency: string | null;
  source: string | null;
  note: string | null;
  importedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// Локально расширяем тип Yacht, потому что /yachts/:id отдает include: country/category/builder
type YachtDetails = Yacht & {
  country?: CountryRef | null;
  category?: CategoryRef | null;
  builder?: BuilderRef | null;
  // currentExtraServices может приходить как JSON-string или как массив/объект
  currentExtraServices?: unknown;
};

function normalizeExtraServices(v: unknown): unknown[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const parsed: unknown = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isExtraServiceArray(v: unknown): v is ExtraService[] {
  return (
    Array.isArray(v) &&
    v.every(
      (x) =>
        typeof x === 'object' &&
        x !== null &&
        typeof (x as Record<string, unknown>).name === 'string' &&
        typeof (x as Record<string, unknown>).price === 'number',
    )
  );
}

  useEffect(() => {
    if (!id) return;
    getYacht(id)
      .then(setYacht)
      .catch((e) => setError(e?.message ?? t('errors.loadFailed')));
  }, [id, t]);

  // ✅ ВАЖНО: хуки должны вызываться ДО любых ранних return
  const yd = yacht as YachtDetails | null;

  // ─────────────────────────────────────────────────────────────
  // Price list nodes (узлы) from backend: yd.priceListNodes
  // ─────────────────────────────────────────────────────────────
  const priceNodes = useMemo(() => {
    const nodes = Array.isArray(yd?.priceListNodes) ? yd!.priceListNodes : [];
    const arr = nodes.slice();
    arr.sort(
      (a, b) =>
        new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime(),
    );
    return arr;
  }, [yd?.priceListNodes]);


  if (error)
    return <div className="text-center mt-16 text-red-600">{error}</div>;
  if (!yacht)
    return (
      <div className="text-center mt-16 text-gray-500">{t('loading')}</div>
    );

  // безаварийный парсинг услуг -> приводим к типизированному массиву 1 раз
  const servicesRaw = normalizeExtraServices(
    (yd as YachtDetails).currentExtraServices,
  );
  const servicesList: ExtraService[] = isExtraServiceArray(servicesRaw)
    ? servicesRaw
    : [];

  // ссылки из бекенда (типизируем через YachtDetails)
  const country = (yd as YachtDetails).country ?? undefined;
  const category = (yd as YachtDetails).category ?? undefined;
  const builder = (yd as YachtDetails).builder ?? undefined;

  const pickCategoryLabel = () => {
    if (!category) return '—';
    const lng = (i18n.language || 'en').toLowerCase();
    if (lng.startsWith('ru'))
      return category.nameRu ?? category.nameEn ?? `#${category.id}`;
    if (lng.startsWith('hr'))
      return (
        category.nameHr ??
        category.nameEn ??
        category.nameRu ??
        `#${category.id}`
      );
    return (
      category.nameEn ?? category.nameRu ?? category.nameHr ?? `#${category.id}`
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{yacht.name}</h1>
        <div className="flex items-center gap-3">
          <Link
            to={{ pathname: '/dashboard', search: location.search }}
            className="text-blue-600 hover:underline"
          >
            ← {t('actions.back')}
          </Link>
          <Link
            to={`/yacht/${yacht.id}/edit`}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 hover:bg-blue-700"
          >
            <PencilSquareIcon className="h-5 w-5 text-white" />
            <span className="text-white">{t('actions.edit')}</span>
          </Link>
        </div>
      </div>

      {/* Manager */}
      <div className="rounded-2xl border p-5 shadow-sm bg-white mt-6">
        <h2 className="font-semibold mb-3">Ответственный менеджер</h2>

        <dl className="text-sm space-y-1">
          <div className="flex gap-2">
            <dt className="text-gray-500 w-40">Менеджер</dt>
            <dd className="flex-1">
              {yacht.responsibleManagerName ?? '—'}
            </dd>
          </div>

        <h2 className="font-semibold mt-4 mb-3">External ID</h2>
          <div className="flex gap-2">
            <dt className="text-gray-500 w-40">
              {t('fields.nausysId', 'NauSYS ID')}
            </dt>
            <dd className="flex-1">
              {yacht.nausysId ?? '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Owner */}
      <div className="rounded-2xl border p-5 shadow-sm bg-white mt-6">
        <span className="text-gray-600">{t('fields.owner')}: </span>
        <span>{yacht.ownerName ?? '—'}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {/* Specs */}
        <div className="rounded-2xl border p-5 shadow-sm bg-white">
          <h2 className="font-semibold mb-3">{t('sections.specs')}</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500">{t('fields.manufacturer')}</dt>
            <dd>{yacht.manufacturer}</dd>

            <dt className="text-gray-500">{t('fields.model')}</dt>
            <dd>{yacht.model}</dd>

            <dt className="text-gray-500">{t('fields.type')}</dt>
            <dd>{yacht.type}</dd>

            <dt className="text-gray-500">
              {t('fields.category', 'Category')}
            </dt>
            <dd>{pickCategoryLabel()}</dd>

            <dt className="text-gray-500">{t('fields.builder', 'Builder')}</dt>
            <dd>{builder?.name ?? '—'}</dd>

            <dt className="text-gray-500">{t('fields.length')}</dt>
            <dd>{yacht.length} ft</dd>

            <dt className="text-gray-500">{t('fields.built')}</dt>
            <dd>{yacht.builtYear}</dd>

            <dt className="text-gray-500">{t('fields.cabinsHeads')}</dt>
            <dd>
              {yacht.cabins} / {yacht.heads}
            </dd>
          </dl>
        </div>

        {/* Charter */}
        <div className="rounded-2xl border p-5 shadow-sm bg-white">
          <h2 className="font-semibold mb-3">{t('sections.charter')}</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500">{t('fields.company')}</dt>
            <dd>{yacht.charterCompany}</dd>

            <dt className="text-gray-500">{t('fields.fleet')}</dt>
            <dd>{yacht.fleet}</dd>

            <dt className="text-gray-500">{t('fields.location')}</dt>
            <dd>{yacht.location}</dd>

            <dt className="text-gray-500">
              {t('fields.country', 'Country')}
            </dt>
            <dd>
              {country ? `${country.name} (${country.code2})` : '—'}
            </dd>
          </dl>
        </div>
      </div>

      {/* Price list (узлы) */}
      <div className="rounded-2xl border p-5 shadow-sm bg-white mt-6">
        <h2 className="font-semibold mb-3">
          {t('sections.priceList', 'Price list')}
        </h2>

        {/* стартовая базовая цена яхты (из карточки яхты) */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4">
          <div className="text-gray-500">{t('fields.basePrice', 'Base price')}</div>
          <div className="font-medium">
            {asMoney(yacht.basePrice ?? null, yacht.currency ?? undefined)}
          </div>
        </div>

        {priceNodes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 text-gray-500">
                    {t('history.weekStart', 'Week start')}
                  </th>
                  <th className="text-left py-2 pr-4 text-gray-500">
                    {t('priceList.price', 'Price (price list)')}
                  </th>
                  <th className="text-left py-2 pr-4 text-gray-500">
                    {t('history.note', 'Note')}
                  </th>
                  <th className="text-left py-2 pr-4 text-gray-500">
                    {t('priceList.updatedAt', 'Updated at')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {priceNodes.map((n) => (
                  <tr key={n.weekStart} className="border-b last:border-0">
                    <td className="py-1 pr-4">{fmtDate(n.weekStart)}</td>
                    <td className="py-1 pr-4">
                      {asMoney(
                        n.price ?? null,
                        n.currency ?? yacht.currency ?? undefined,
                      )}
                    </td>
                    <td className="py-1 pr-4">{n.note || '—'}</td>
                    <td className="py-1 pr-4">
                      {fmtWhen(n.updatedAt ?? n.createdAt ?? n.importedAt ?? null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-500">{t('noData')}</div>
        )}

      </div>

      {/* Price history */}
      <div className="rounded-2xl border p-5 shadow-sm bg-white mt-6">
        <h2 className="font-semibold mb-3">
          {t('sections.priceHistory', 'Price history')}
        </h2>

        {Array.isArray(yacht.priceHistory) &&
        yacht.priceHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th
                    className="text-left py-2 pr-4 text-gray-500 cursor-pointer select-none"
                    onClick={() => toggleSort('weekStart')}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t('history.weekStart', 'Week start')}
                      <span className="text-xs">
                        {sortKey === 'weekStart'
                          ? sortDir === 'asc'
                            ? '↑'
                            : '↓'
                          : '↕︎'}
                      </span>
                    </span>
                  </th>

                  <th
                    className="text-left py-2 pr-4 text-gray-500 cursor-pointer select-none"
                    onClick={() => toggleSort('price')}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t('history.price', 'Price')}
                      <span className="text-xs">
                        {sortKey === 'price'
                          ? sortDir === 'asc'
                            ? '↑'
                            : '↓'
                          : '↕︎'}
                      </span>
                    </span>
                  </th>
                  
                  <th
                    className="text-left py-2 pr-4 text-gray-500 cursor-pointer select-none"
                    onClick={() => toggleSort('discount')}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t('history.discount', 'Discount')}
                      <span className="text-xs">
                        {sortKey === 'discount'
                          ? sortDir === 'asc'
                            ? '↑'
                            : '↓'
                          : '↕︎'}
                      </span>
                    </span>
                  </th>

                  {/* Несортируемая колонка Примечание / Note */}
                  <th className="text-left py-2 pr-4 text-gray-500">
                    {t('history.note', 'Note')}
                  </th>

                  <th
                    className="text-left py-2 pr-4 text-gray-500 cursor-pointer select-none"
                    onClick={() => toggleSort('date')}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t('history.date', 'Date')}
                      <span className="text-xs">
                        {sortKey === 'date'
                          ? sortDir === 'asc'
                            ? '↑'
                            : '↓'
                          : '↕︎'}
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {yacht.priceHistory
                  .slice()
                  .sort((a, b) => {
                    let v1 = 0;
                    let v2 = 0;

                    switch (sortKey) {
                      case 'weekStart':
                        v1 = new Date(a.weekStart).getTime();
                        v2 = new Date(b.weekStart).getTime();
                        break;
                      case 'price':
                        v1 = a.price != null ? Number(a.price) : 0;
                        v2 = b.price != null ? Number(b.price) : 0;
                        break;
                      case 'discount':
                        v1 =
                          a.discountPct != null ? Number(a.discountPct) : 0;
                        v2 =
                          b.discountPct != null ? Number(b.discountPct) : 0;
                        break;
                      case 'date':
                        v1 = new Date(a.date).getTime();
                        v2 = new Date(b.date).getTime();
                        break;
                    }

                    return sortDir === 'asc' ? v1 - v2 : v2 - v1;
                  })
                  .map((h, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-1 pr-4">{fmtWhen(h.weekStart)}</td>
                      <td className="py-1 pr-4">
                        {asMoney(
                          h.price ?? null,
                          yacht.currency ?? undefined,
                        )}
                      </td>
                      <td className="py-1 pr-4">
                        {asPercent(h.discountPct ?? null)}
                      </td>
                      <td className="py-1 pr-4">{h.note || '—'}</td>
                      <td className="py-1 pr-4">{fmtWhen(h.date)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            {t('history.empty', 'No price history yet')}
          </div>
        )}
      </div>

      {/* Extra services */}
      <div className="rounded-2xl border p-5 shadow-sm bg-white mt-6">
        <h2 className="font-semibold mb-3">
          {t('sections.extraServices')}
        </h2>
        {servicesList.length > 0 ? (
          <ul className="list-disc ml-5 text-sm">
            {servicesList.map((s, i) => (
              <li key={i}>
                {s.name} — {s.price}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-gray-500">{t('noData')}</div>
        )}
      </div>
    </div>
  );
}
