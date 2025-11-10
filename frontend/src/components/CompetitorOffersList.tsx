// frontend/src/components/CompetitorOffersList.tsx

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CompetitorPrice } from '../api';

type Props = {
  prices: CompetitorPrice[];
};

export default function CompetitorOffersList({ prices }: Props) {
  const { t } = useTranslation('yacht');
  if (!prices.length) return null;

  return (
      <div className="mt-2 rounded border p-2">
          <div className="mb-1 text-[11px] text-gray-600">
              {t('competitorOffers.header', '{{count}} offers', { count: prices.length })}
          </div>
          <ul className="max-h-40 space-y-1 overflow-auto pr-1">
              {prices.map((p) => {
                  const parts: string[] = [];

                  // Модель (или fallback)
                  const model =
                      (p as any).modelName?.trim() ||
                      p.competitorYacht?.trim() ||
                      '—';
                  parts.push(model);

                  // Длина в футах
                  if (p.lengthFt != null) {
                      const len = Number(p.lengthFt);
                      if (Number.isFinite(len)) {
                          const s = len.toFixed(1).replace(/\.0$/, '');
                          parts.push(`${s} ft`);
                      }
                  }

                  // Год постройки
                  if (p.year != null) {
                      parts.push(`(${p.year})`);
                  }

                  // География: страна + марина
                  const country =
                      (p as any).countryName?.trim() ||
                      p.countryCode?.trim() ||
                      '';
                  const marina =
                      (p as any).marinaName?.trim() ||
                      p.marina?.trim() ||
                      '';

                  if (country && marina) {
                      parts.push(`${country} · ${marina}`);
                  } else if (country) {
                      parts.push(country);
                  } else if (marina) {
                      parts.push(marina);
                  }

                  // Кабины / санузлы
                  let cabinsHeads = '';
                  if (p.cabins != null) cabinsHeads += `${p.cabins}c`;
                  if (p.heads != null) cabinsHeads += (cabinsHeads ? '/' : '') + `${p.heads}h`;
                  if (cabinsHeads) parts.push(cabinsHeads);

                  const label = parts.join(' · ');

                  return (
                      <li key={p.id} className="flex justify-between gap-2 text-[11px]">
                          <span className="truncate">{label}</span>
                          <span className="shrink-0">
                              {p.price} {p.currency ?? ''}
                          </span>
                      </li>
                  );
              })}
          </ul>
      </div>
  );
}