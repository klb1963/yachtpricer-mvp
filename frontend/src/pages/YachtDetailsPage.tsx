// frontend/src/pages/YachtDetailsPage.tsx

import { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { getYacht } from '../api';
import type { Yacht } from '../api';
import { PencilSquareIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

// ─ helpers (как на PricingPage) ─
function asMoney(n: number | string | null | undefined) {
  if (n == null) return '—';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num as number)) return '—';
  return `€ ${(num as number).toLocaleString('en-EN', { maximumFractionDigits: 0 })}`;
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

export default function YachtDetailsPage() {
  const { t, i18n } = useTranslation('yacht');
  const { id } = useParams();
  const [yacht, setYacht] = useState<Yacht | null>(null);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    if (!id) return;
    getYacht(id)
      .then(setYacht)
      .catch((e) => setError(e?.message ?? t('errors.loadFailed')));
  }, [id, t]);

  if (error) return <div className="text-center mt-16 text-red-600">{error}</div>;
  if (!yacht) return <div className="text-center mt-16 text-gray-500">{t('loading')}</div>;

  // безаварийный парсинг услуг
  let services: any = yacht.currentExtraServices;
  if (typeof services === 'string') {
    try {
      services = JSON.parse(services);
    } catch {
      services = [];
    }
  }

  // ссылки из бекенда (могут быть не в типе Yacht, поэтому any)
  const country = (yacht as any)?.country as { id: string; code2: string; name: string } | undefined;
  const category = (yacht as any)?.category as { id: number; nameEn?: string | null; nameRu?: string | null; nameHr?: string | null } | undefined;
  const builder = (yacht as any)?.builder as { id: number; name: string } | undefined;

  const pickCategoryLabel = () => {
    if (!category) return '—';
    const lng = (i18n.language || 'en').toLowerCase();
    if (lng.startsWith('ru')) return category.nameRu ?? category.nameEn ?? `#${category.id}`;
    if (lng.startsWith('hr')) return category.nameHr ?? category.nameEn ?? category.nameRu ?? `#${category.id}`;
    return category.nameEn ?? category.nameRu ?? category.nameHr ?? `#${category.id}`;
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

      <div className="grid md:grid-cols-2 gap-6">
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

            <dt className="text-gray-500">{t('fields.category', 'Category')}</dt>
            <dd>{pickCategoryLabel()}</dd>

            <dt className="text-gray-500">{t('fields.builder', 'Builder')}</dt>
            <dd>{builder?.name ?? '—'}</dd>

            <dt className="text-gray-500">{t('fields.length')}</dt>
            <dd>{yacht.length} m</dd>

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

            <dt className="text-gray-500">{t('fields.country', 'Country')}</dt>
            <dd>{country ? `${country.name} (${country.code2})` : '—'}</dd>
            
          </dl>
        </div>
      </div>

      {/* Pricing */}
      <div className="rounded-2xl border p-5 shadow-sm bg-white mt-6">
        <h2 className="font-semibold mb-3">{t('sections.pricing')}</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-gray-500">{t('fields.basePrice')}</dt>
          <dd>{asMoney(yacht.basePrice)}</dd>

          <dt className="text-gray-500">{t('fields.maxDiscountPct')}</dt>
          <dd>{asPercent(yacht.maxDiscountPct ?? null)}</dd>

          <dt className="text-gray-500">{t('fields.actualPrice')}</dt>
          <dd>{asMoney(yacht.actualPrice ?? null)}</dd>

          <dt className="text-gray-500">{t('fields.actualDiscount')}</dt>
          <dd>{asPercent(yacht.actualDiscountPct ?? null)}</dd>

          <dt className="text-gray-500">{t('fields.fetchedAt')}</dt>
          <dd title={yacht.fetchedAt ?? ''}>{fmtWhen(yacht.fetchedAt ?? null)}</dd>
        </dl>
      </div>

      {/* Extra services */}
      <div className="rounded-2xl border p-5 shadow-sm bg-white mt-6">
        <h2 className="font-semibold mb-3">{t('sections.extraServices')}</h2>
        {Array.isArray(services) && services.length > 0 ? (
          <ul className="list-disc ml-5 text-sm">
            {services.map((s: { name: string; price: number }, i: number) => (
              <li key={i}>
                {s.name} — {s.price}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-gray-500">{t('noData')}</div>
        )}
      </div>

      {/* Owner */}
      <div className="rounded-2xl border p-5 shadow-sm bg-white mt-6">
        <span className="text-gray-600">{t('fields.owner')}: </span>
        <span>{yacht.ownerName ?? '—'}</span>
      </div>
    </div>
  )
}