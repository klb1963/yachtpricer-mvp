// frontend/src/components/YachtCard.tsx
// props: { y: Yacht; search?: string }

import { Link } from 'react-router-dom';
import type { Yacht, CompetitorPrice } from '../api';
import { useTranslation } from 'react-i18next';
import type { ScrapeSource } from '../api'

// Бэкенд может прислать imageUrl (опционально)
type YachtWithImage = Yacht & { imageUrl?: string | null };

// Тип агрегатов
type Agg = { top1: string; avg: string; cur: string; n: number };

// Все пропсы карточки (новые: agg, details, open, onToggleDetails, scanning, onScan)
type Props = {
  y: YachtWithImage;
  search?: string;
  onScan?: (y: YachtWithImage) => void;
  scanning?: boolean;
  agg?: Agg;
  details?: CompetitorPrice[];
  open?: boolean;
  onToggleDetails?: () => void;
  warning?: string | string[] | null;
  scanSource?: ScrapeSource;  // ← добавлено
};

// Карта типов -> картинка из /public/images/yachts
const IMAGE_MAP: Record<string, string> = {
  monohull: '/images/yachts/monohull.jpg',
  'sailing yacht': '/images/yachts/monohull.jpg', // алиас
  sailboat: '/images/yachts/monohull.jpg',        // алиас
  catamaran: '/images/yachts/catamaran.jpg',
  trimaran: '/images/yachts/trimaran.jpg',
  compromis: '/images/yachts/compromis.jpg',
};

const FALLBACK_PLACEHOLDER = '/images/yachts/monohull.jpg';

function normalizeTypeKey(type?: string | null) {
  const k = (type ?? '').toLowerCase().trim();
  if (k === 'sailing yacht' || k === 'sailboat' || k === 'monohull') return 'monohull';
  if (k === 'catamaran') return 'catamaran';
  if (k === 'trimaran') return 'trimaran';
  if (k === 'compromis') return 'compromis';
  return k;
}

function pickByType(type?: string | null) {
  const key = normalizeTypeKey(type);
  return IMAGE_MAP[key] ?? FALLBACK_PLACEHOLDER;
}

function fmtPrice(p: Yacht['basePrice']) {
  if (typeof p === 'string') return p;
  if (typeof p === 'number' && Number.isFinite(p)) return String(Math.round(p));
  return '—';
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      {children}
    </span>
  );
}

export default function YachtCard({
  y,
  search,
  onScan,
  scanning,
  agg,
  details = [],
  open = false,
  onToggleDetails,
  warning,
  scanSource = 'INNERDB', // дефолтное значение
}: Props) {

  const { t } = useTranslation('yacht');

  const isNew =
    y.createdAt ? Date.now() - new Date(y.createdAt).getTime() < 7 * 24 * 3600 * 1000 : false;

  // 1) Берём из БД, 2) иначе по типу
  const fromDb = (y.imageUrl ?? '').trim();
  const src = fromDb || pickByType(y.type);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100">
        <img
          src={src}
          alt={y.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          loading="lazy"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).src = pickByType(y.type)
          }}
        />
        {isNew && (
          <span className="absolute left-3 top-3 rounded-full bg-green-600/90 px-2 py-0.5 text-xs font-semibold text-white">
            {t('new') || 'New'}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-gray-900">{y.name}</h3>
            <p className="truncate text-sm text-gray-600">
              {y.manufacturer} {y.model}
            </p>
          </div>
          <Badge>{y.type}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700">
          <div className="text-gray-500">{t('fields.length')}</div>
          <div className="font-medium">{y.length} ft</div>

          <div className="text-gray-500">{t('fields.built')}</div>
          <div className="font-medium">{y.builtYear}</div>

          <div className="text-gray-500">{t('fields.location')}</div>

          <div className="font-medium flex items-center gap-2">
            <span className="truncate">{y.location || '—'}</span>
            {(y.countryCode || y.countryName) && (
              <span className="shrink-0 ml-1 inline-block rounded border px-1.5 py-0.5 text-xs text-gray-700">
                {y.countryCode || ''}
                {y.countryName ? ` · ${y.countryName}` : ''}
              </span>
            )}
          </div>

          <div className="text-gray-500">{t('fields.owner')}</div>
          <div className="truncate font-medium">{y.ownerName ?? '—'}</div>
        </div>

        {/* Агрегаты конкурентов: TOP1/AVG + Details; резервируем высоту, чтобы карточка не дёргалась */}
        <div className="mt-1">
          {agg ? (
            <div className="flex items-center justify-between text-[12px] text-gray-800">
              <div className="whitespace-normal break-words">
                TOP1:{' '}
                <b>
                  {agg.top1} {agg.cur}
                </b>
                ,&nbsp; AVG(Top3): <b>{agg.avg}</b>&nbsp;({agg.n})
              </div>
              {details.length > 0 && onToggleDetails && (
                <button
                  type="button"
                  onClick={onToggleDetails}
                  className="ml-2 shrink-0 rounded border px-2 py-0.5 text-[11px] hover:bg-gray-100"
                  title="Show raw competitor cards"
                >
                  {open ? 'Hide' : 'Details'}
                </button>
              )}
            </div>
          ) : (
            <div className="h-5 text-[12px] text-gray-400">—</div>
          )}
        </div>

        {/* Предупреждение, если конкуренты не найдены */}
        {(!agg || agg.n === 0) && warning && (
          <div className="mt-2 rounded bg-yellow-100 p-2 text-sm text-yellow-800">
            <b>No competitors found</b> for this week with current Competitor filters.
            <div style={{ marginTop: 4 }}>
              {Array.isArray(warning) ? warning.join(', ') : warning}
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
                    {p.competitorYacht ?? '—'} {p.year ? `(${p.year})` : ''} · {p.marina ?? '—'}
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

        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <div className="text-xs text-gray-500">{t('fields.basePrice')}</div>
            <div className="text-lg font-bold text-gray-900">€ {fmtPrice(y.basePrice)}</div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            {onScan && (
              <button
                type="button"
                onClick={() => onScan(y)}
                disabled={!!scanning}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${
                  scanning ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
                title="Fetch competitors and aggregate"
              >
                {scanning ? t('loading') : 'Scan'}
              </button>
            )}
            <Link
              className="rounded border px-3 py-1 hover:bg-gray-50"
              to={{ pathname: `/yacht/${y.id}`, search }}
            >
              {t('actions.view') || 'View'}
            </Link>
            <Link
              to={{ pathname: `/yacht/${y.id}/edit`, search }}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {t('actions.edit')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}