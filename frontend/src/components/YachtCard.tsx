// frontend/src/components/YachtCard.tsx
// props: { y: Yacht; search?: string }

import { Link } from 'react-router-dom';
import type { Yacht } from '../api';

// Карта типов -> картинка из /public/images/yachts
const IMAGE_MAP: Record<string, string> = {
  monohull: '/images/yachts/monohull.jpg',
  catamaran: '/images/yachts/catamaran.jpg',
  trimaran: '/images/yachts/trimaran.jpg',
  compromis: '/images/yachts/compromis.jpg',
};

const FALLBACK_PLACEHOLDER = '/images/yachts/monohull.jpg'; // общий дефолт

function pickByType(type?: string | null) {
  const key = type?.toLowerCase?.() ?? '';
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

export default function YachtCard({ y, search }: { y: Yacht; search?: string }) {
  const isNew =
    y.createdAt ? Date.now() - new Date(y.createdAt).getTime() < 7 * 24 * 3600 * 1000 : false;

  // 1) Берём из БД, 2) иначе по типу, 3) else — общий дефолт
  const src = (y.imageUrl && y.imageUrl.trim()) || pickByType(y.type);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100">
        <img
          src={src}
          alt={y.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          loading="lazy"
          onError={(e) => {
            // если ссылка битая — подставим резерв по типу
            (e.currentTarget as HTMLImageElement).src = pickByType(y.type);
          }}
        />
        {isNew && (
          <span className="absolute left-3 top-3 rounded-full bg-green-600/90 px-2 py-0.5 text-xs font-semibold text-white">
            New
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
          <div className="text-gray-500">Length</div>
          <div className="font-medium">{y.length} m</div>

          <div className="text-gray-500">Year</div>
          <div className="font-medium">{y.builtYear}</div>

          <div className="text-gray-500">Location</div>
          <div className="truncate font-medium">{y.location}</div>

          <div className="text-gray-500">Owner</div>
          <div className="truncate font-medium">{y.ownerName ?? '—'}</div>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <div className="text-xs text-gray-500">Base price</div>
            <div className="text-lg font-bold text-gray-900">€ {fmtPrice(y.basePrice)}</div>
          </div>

          <div className="flex gap-2">
            <Link
              className="rounded border px-3 py-1 hover:bg-gray-50"
              to={{ pathname: `/yacht/${y.id}`, search }}
            >
              View
            </Link>
            <Link
              to={{ pathname: `/yacht/${y.id}/edit`, search }}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Edit
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
