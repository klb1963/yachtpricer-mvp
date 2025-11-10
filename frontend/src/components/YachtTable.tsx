import React from 'react';
import { Link } from 'react-router-dom';
import type { Yacht } from '../api';
import type { CompetitorPrice } from '../api';
import { useTranslation } from 'react-i18next';
import type { ScrapeSource } from '../api'

type SortKey = 'priceAsc' | 'priceDesc' | 'yearAsc' | 'yearDesc' | 'createdDesc';

export interface YachtAgg {
  top1: string;
  avg: string;
  cur: string;
  n: number;
}

interface Props {
  items: Yacht[];
  locationSearch: string;
  sort: SortKey;
  onSortBy: (field: 'price' | 'year') => void;

  busyId: string | null;
  aggByYacht: Record<string, YachtAgg | undefined>;
  rawByYacht: Record<string, { prices: CompetitorPrice[]; source?: ScrapeSource }>;
  scanSource: ScrapeSource;
  rowsOpen: Record<string, boolean>;

  onScan: (yacht: Yacht) => void;
  onToggleDetails: (id: string) => void;

  lastWarningByYacht?: Record<string, string | string[] | null>;
}

const YachtTable: React.FC<Props> = ({
  items,
  locationSearch,
  sort,
  onSortBy,
  busyId,
  aggByYacht,
  rawByYacht,
  rowsOpen,
  onScan,
  onToggleDetails,
  lastWarningByYacht,
  scanSource,
}) => {
  const { t } = useTranslation('yacht');
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:font-semibold [&>th]:text-gray-800 text-left">
            <th>{t('fields.name') || 'Name'}</th>
            <th>{t('fields.model') || 'Model'}</th>
            <th>{t('fields.type') || 'Type'}</th>
            <th>{t('fields.length') || 'Length'}</th>
            <th>
              <button
                type="button"
                onClick={() => onSortBy('year')}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 !text-gray-900 hover:!text-gray-900 hover:bg-gray-100"
                title={t('sort.byYear') || 'Sort by year'}
              >
                {t('fields.built') || 'Year'}
                <span className={sort.startsWith('year') ? 'text-blue-600 font-bold' : 'text-gray-400'}>
                  {sort === 'yearAsc' ? '↑' : sort === 'yearDesc' ? '↓' : ''}
                </span>
              </button>
            </th>
            <th>{t('fields.country') || 'Country'}</th>
            <th>{t('fields.location') || 'Location'}</th>
            <th>
              <button
                type="button"
                onClick={() => onSortBy('price')}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 !text-gray-900 hover:!text-gray-900 hover:bg-gray-100"
                title={t('sort.byPrice') || 'Sort by price'}
              >
                {t('fields.basePrice') || 'Price (base)'}
                <span className={sort.startsWith('price') ? 'text-blue-600 font-bold' : 'text-gray-400'}>
                  {sort === 'priceAsc' ? '↑' : sort === 'priceDesc' ? '↓' : ''}
                </span>
              </button>
            </th>
            <th>{t('competitors') || 'Competitors'}</th>
            <th className="px-4 py-2 text-left">{t('fields.owner') || 'Owner'}</th>
          </tr>
        </thead>

        <tbody>
          {items.map((y) => {
          const agg = aggByYacht[y.id]
          const details =
            rawByYacht[y.id]?.source === scanSource ? (rawByYacht[y.id]?.prices ?? []) : []
           const open = !!rowsOpen[y.id]

            return (
              <tr key={y.id} className="border-t [&>td]:px-4 [&>td]:py-2">
                <td>
                  <Link
                    className="text-blue-600 hover:underline"
                    to={{ pathname: `/yacht/${y.id}`, search: locationSearch }}
                  >
                    {y.name}
                  </Link>
                </td>
                <td>
                  {y.manufacturer} {y.model}
                </td>
                <td>{y.type}</td>
                <td>{y.length} ft</td>
                <td>{y.builtYear}</td>
                <td>
                  {y.countryCode
                    ? `${y.countryCode}${y.countryName ? ' — ' + y.countryName : ''}`
                    : '—'}
                </td>
                <td>{y.location}</td>
                <td>
                  {(() => {
                    // weekly base price для выбранной недели (если есть),
                    // иначе — старое поле basePrice
                    const raw = y.currentBasePrice ?? y.basePrice;
                    if (raw == null) return '—';

                    const num = typeof raw === 'string' ? Number(raw) : raw;
                    if (!Number.isFinite(num as number)) {
                      // если не распарсилось число — покажем как есть
                      return String(raw);
                    }

                    const rounded = Math.round(num as number);
                    const cur = y.currency ?? '€';
                    return `${rounded} ${cur}`;
                  })()}
                </td>

                {/* Competitors cell */}
                <td className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onScan(y)}
                      disabled={busyId === y.id}
                      className={`rounded px-3 py-1 text-sm font-medium ${
                        busyId === y.id
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      title={t('hints.fetchCompetitors') || 'Fetch competitors and aggregate'}
                    >
                      {busyId === y.id ? (t('actions.scanning') || 'Scanning…') : (t('actions.scan') || 'Scan')}

                    </button>

                    {agg ? (
                      <span className="text-xs text-gray-800">
                        TOP1:{' '}
                        <b>
                          {agg.top1} {agg.cur}
                        </b>
                        ,&nbsp; AVG(Top3): <b>{agg.avg}</b>&nbsp;({agg.n})
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}

                    {details.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onToggleDetails(y.id)}
                        className="rounded border px-1.5 py-0.5 text-xs hover:bg-gray-100"
                        title={t('hints.showDetails') || 'Show raw competitor cards'}
                      >
                        {open ? (t('actions.hide') || 'Hide') : (t('actions.details') || 'Details')}
                      </button>
                    )}
                  </div>

                  {/* Показывать предупреждение только если нет найденных конкурентов (agg отсутствует или agg.n === 0) */}
                  {(!agg || agg.n === 0) && lastWarningByYacht?.[y.id] && (
                    <div className="mt-2 rounded bg-yellow-100 p-2 text-xs text-yellow-800">
                      <b>No competitors found</b> for this week with current Competitor filters.
                      <div className="mt-1">
                        {Array.isArray(lastWarningByYacht[y.id])
                          ? (lastWarningByYacht[y.id] as string[]).join(', ')
                          : (lastWarningByYacht[y.id] as string)}
                      </div>
                    </div>
                  )}

                  {open && details.length > 0 && (
                    <div className="mt-2 rounded border p-2">
                      <div className="mb-1 text-[11px] text-gray-600">{details.length} offers:</div>
                      <ul className="max-h-40 space-y-1 overflow-auto pr-1">
                        {details.map((p) => (
                          <li key={p.id} className="flex justify-between gap-2 text-[11px]">
                            <span className="truncate">
                              {p.competitorYacht ?? '—'} {p.year ? `(${p.year})` : ''} ·{' '}
                              {p.marina ?? '—'}
                              {p.cabins != null ? ` · ${p.cabins}c` : ''}
                              {p.heads != null ? `/${p.heads}h` : ''}
                            </span>
                            <span className="shrink-0">
                              {p.price} {p.currency ?? ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </td>

                <td className="px-4 py-2">{y.ownerName ?? '—'}</td>
              </tr>
            )
          })}

          {items.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-gray-500">
                {t('noResults') || 'No results'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default React.memo(YachtTable);