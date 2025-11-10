// frontend/src/utils/formatCompetitor.ts
import type { CompetitorPrice } from '../api';

// Расширенный тип с возможными дополнительными полями от backend'а
type ExtendedCompetitor = CompetitorPrice & {
  modelName?: string | null;
  marinaName?: string | null;
  countryName?: string | null;
};

// Универсальный форматтер: модель · длина · (год) · страна · марина · 3c/2h
export function formatCompetitorLine(p: ExtendedCompetitor): string {
  const parts: string[] = [];

  const model =
    p.modelName?.trim() ||
    p.competitorYacht?.trim() ||
    '—';
  parts.push(model);

  if (p.lengthFt != null) {
    const len = Number(p.lengthFt);
    if (Number.isFinite(len)) {
      const s = len.toFixed(1).replace(/\.0$/, '');
      parts.push(`${s} ft`);
    }
  }

  if (p.year != null) parts.push(`(${p.year})`);

  const country =
    p.countryName?.trim() ||
    p.countryCode?.trim() ||
    '';
  const marina =
    p.marinaName?.trim() ||
    p.marina?.trim() ||
    '';

  if (country && marina) parts.push(`${country} · ${marina}`);
  else if (country) parts.push(country);
  else if (marina) parts.push(marina);

  let cabinsHeads = '';
  if (p.cabins != null) cabinsHeads += `${p.cabins}c`;
  if (p.heads != null) cabinsHeads += (cabinsHeads ? '/' : '') + `${p.heads}h`;
  if (cabinsHeads) parts.push(cabinsHeads);

  return parts.join(' · ');
}