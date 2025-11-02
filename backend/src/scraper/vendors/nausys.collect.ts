// backend/src/scraper/vendors/nausys.collect.ts

import { PrismaClient } from '@prisma/client';
import {
  getCharterBases,
  getYachtsByCompany,
  getFreeYachtsSearch,
  ddmmyyyy,
  NauSysCreds,
  NauSysCharterBase,
  NauSysYacht,
  NauSysFreeYachtItem,
} from './nausys.client';
import type { NauSysCandidate } from './nausys.runner';

const prisma = new PrismaClient();

// ---- type guards
function isCharterBase(v: unknown): v is NauSysCharterBase {
  const r = v as { companyId?: unknown };
  return r != null && typeof r.companyId === 'number';
}
function isYacht(v: unknown): v is NauSysYacht {
  const r = v as { id?: unknown };
  return r != null && typeof r.id === 'number';
}
function isFreeItem(v: unknown): v is NauSysFreeYachtItem {
  const r = v as { yachtId?: unknown } | null | undefined;
  return r != null && typeof r.yachtId === 'number';
}
function pickArray<T>(val: unknown, guard: (u: unknown) => u is T): T[] {
  return Array.isArray(val) ? (val as unknown[]).filter(guard) : [];
}

type BasesWrap = { bases?: unknown };
type YWrap = { yachts?: unknown };

type NauSysYachtLoose = NauSysYacht &
  Partial<{
    yachtBuildYear: number;
    yachtCabins: number;
    heads: number;
    yachtHeads: number;
    length: number;
    yachtLengthMeters: number;
    baseLocationId: number;
    yachtModelId: number;
  }>;

function num(v: unknown): number | null {
  if (v == null) return null;
  const n =
    typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

type NauSysFreeYachtsSearchResponse = Partial<{
  status: string;
  from: string;
  to: string;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  resultsPerPage: number;
  startIdx: number;
  endIdx: number;
  freeYachtsInPeriod: unknown;
}>;

function pickFreeSearchItems(resp: unknown): NauSysFreeYachtItem[] {
  const r = (resp ?? {}) as NauSysFreeYachtsSearchResponse;
  const arr = Array.isArray(r.freeYachtsInPeriod)
    ? r.freeYachtsInPeriod
    : (r as unknown as { freeYachts?: unknown })?.freeYachts;
  return pickArray(arr, isFreeItem);
}

export async function collectNausysCandidates(params: {
  creds: NauSysCreds;
  periodFrom: Date;
  periodTo: Date;
  /** hint для типа у кандидатов, обычно тип target яхты */
  candidateTypeHint?: string | null;
}): Promise<Array<NauSysCandidate & { raw: NauSysFreeYachtItem }>> {
  const { creds, periodFrom, periodTo, candidateTypeHint = null } = params;

  const PERIOD_FROM = ddmmyyyy(periodFrom);
  const PERIOD_TO = ddmmyyyy(periodTo);

  // 1) charter bases → companyIds
  const basesRes = await getCharterBases(creds);
  let bases: NauSysCharterBase[] = pickArray(basesRes, isCharterBase);
  if (bases.length === 0) {
    const maybe = (basesRes as BasesWrap)?.bases;
    bases = pickArray(maybe, isCharterBase);
  }
  const companyIds = Array.from(
    new Set(
      bases
        .map((b) => Number(b?.companyId))
        .filter(
          (v): v is number => typeof v === 'number' && Number.isFinite(v),
        ),
    ),
  );
  if (companyIds.length === 0) return [];

  // ───────────────────────────────────────────────────────────────
  // Построим мапу: locationId -> countryCode (из charter bases)
  // ───────────────────────────────────────────────────────────────
  const nameToIso2 = (name?: string | null): string | null => {
    if (!name) return null;
    const n = String(name).toLowerCase();
    if (n.includes('croatia')) return 'HR';
    if (n.includes('greece')) return 'GR';
    if (n.includes('turkey')) return 'TR';
    if (n.includes('italy')) return 'IT';
    if (n.includes('spain')) return 'ES';
    if (n.includes('france')) return 'FR';
    return null;
  };
  type BaseLoose = Partial<{
    locationId: number;
    baseLocationId: number;
    countryCode: string;
    country: { code?: string | null; name?: string | null } | null;
    countryName: string | null;
  }>;
  const byLocationCountry = new Map<number, string>();
  for (const bRaw of bases as unknown as BaseLoose[]) {
    const lid =
      typeof bRaw?.locationId === 'number'
        ? bRaw.locationId
        : typeof bRaw?.baseLocationId === 'number'
          ? bRaw.baseLocationId
          : null;
    const cc =
      (bRaw?.countryCode && String(bRaw.countryCode).toUpperCase()) ||
      (bRaw?.country?.code && String(bRaw.country.code).toUpperCase()) ||
      nameToIso2(bRaw?.country?.name ?? bRaw?.countryName);
    if (lid != null && cc && cc.length === 2) {
      byLocationCountry.set(lid, cc);
    }
  }

  // 2) yachts by company → собираем мету (год/каюты/длина/локация/модель)
  type YachtMeta = {
    year?: number | null;
    cabins?: number | null;
    heads?: number | null;
    lengthM?: number | null;
    locationId?: number | null;
    modelId?: number | null;
  };
  const byYachtMeta = new Map<number, YachtMeta>();

  for (const companyIdRaw of companyIds) {
    const companyId = Number(companyIdRaw);
    if (!Number.isFinite(companyId)) continue;

    const yRes = await getYachtsByCompany(creds, companyId);
    let yachts: NauSysYacht[] = pickArray(yRes, isYacht);
    if (yachts.length === 0) {
      const maybe = (yRes as YWrap)?.yachts;
      yachts = pickArray(maybe, isYacht);
    }

    for (const yRaw of yachts) {
      const y = yRaw as NauSysYachtLoose;
      const id = Number(y?.id);
      if (!Number.isFinite(id)) continue;

      const meta: YachtMeta = {
        year:
          (typeof y?.buildYear === 'number' ? y.buildYear : null) ??
          (typeof y?.yachtBuildYear === 'number' ? y.yachtBuildYear : null) ??
          null,
        cabins:
          (typeof y?.cabins === 'number' ? y.cabins : null) ??
          (typeof y?.yachtCabins === 'number' ? y.yachtCabins : null) ??
          null,
        heads:
          (typeof y?.wc === 'number' ? y.wc : null) ??
          (typeof y?.heads === 'number' ? y.heads : null) ??
          (typeof y?.yachtHeads === 'number' ? y.yachtHeads : null) ??
          null,
        lengthM:
          (typeof y?.length === 'number' ? y.length : null) ??
          (typeof y?.yachtLengthMeters === 'number'
            ? y.yachtLengthMeters
            : null) ??
          null,
        locationId:
          (typeof y?.locationId === 'number' ? y.locationId : null) ??
          (typeof y?.baseLocationId === 'number' ? y.baseLocationId : null) ??
          null,
        modelId: typeof y?.yachtModelId === 'number' ? y.yachtModelId : null,
      };
      byYachtMeta.set(id, meta);
    }
  }

  // 2b) если не хватает длины → подтянем из локальной YachtModel (loa — метры)
  const needModelIds = Array.from(
    new Set(
      [...byYachtMeta.values()]
        .filter((m) => m.lengthM == null && typeof m.modelId === 'number')
        .map((m) => m.modelId!),
    ),
  );
  if (needModelIds.length > 0) {
    const models = await prisma.yachtModel.findMany({
      where: { nausysId: { in: needModelIds } },
      select: { nausysId: true, loa: true },
    });
    const mapLen = new Map<number, number>();
    for (const m of models) {
      const mid = Number(m.nausysId);
      const lenM = Number(m.loa);
      if (Number.isFinite(mid) && Number.isFinite(lenM) && lenM > 0) {
        mapLen.set(mid, lenM);
      }
    }
    for (const [, meta] of byYachtMeta) {
      if (meta.lengthM == null && typeof meta.modelId === 'number') {
        const lm = mapLen.get(meta.modelId);
        if (lm != null) meta.lengthM = lm;
      }
    }
  }

  // 3) постранично freeYachtsSearch
  const RESULTS_PER_PAGE = 200;
  const free: NauSysFreeYachtItem[] = [];
  let page = 1;
  while (true) {
    const resp = await getFreeYachtsSearch(creds, {
      periodFrom: PERIOD_FROM,
      periodTo: PERIOD_TO,
      countries: [],
      resultsPerPage: RESULTS_PER_PAGE,
      resultsPage: page,
    });
    const items = pickFreeSearchItems(resp);
    if (items.length === 0) break;
    free.push(...items);
    if (items.length < RESULTS_PER_PAGE) break;
    page++;
  }

  // 4) превратим в кандидатов (без записи)
  const candidates: Array<NauSysCandidate & { raw: NauSysFreeYachtItem }> = [];
  for (const fy of free) {
    const yachtIdNum = Number(fy?.yachtId);
    const priceFinal = num(fy?.price?.clientPrice);
    if (!Number.isFinite(yachtIdNum) || !priceFinal) continue;

    const meta = byYachtMeta.get(yachtIdNum);

    const year =
      num(fy?.yacht?.buildYear) ??
      num(fy?.buildYear) ??
      num(fy?.yachtBuildYear) ??
      meta?.year ??
      null;

    const cabins =
      num(fy?.yacht?.cabins) ??
      num(fy?.cabins) ??
      num(fy?.yachtCabins) ??
      meta?.cabins ??
      null;

    const heads =
      num(fy?.yacht?.wc) ??
      num(fy?.yacht?.heads) ??
      num(fy?.heads) ??
      num(fy?.yachtHeads) ??
      meta?.heads ??
      null;

    const lengthM =
      num(fy?.yacht?.length) ??
      num(fy?.length) ??
      num(fy?.yachtLengthMeters) ??
      meta?.lengthM ??
      null;

    const lengthFt =
      lengthM != null ? Math.round(lengthM * 3.28084 * 10) / 10 : null;

    // безопасное извлечение locationFromId без any
    const locationFromIdVal = (fy as { locationFromId?: unknown })
      .locationFromId;
    const locationFromId =
      typeof locationFromIdVal === 'number' ? locationFromIdVal : null;

    const marina =
      locationFromId != null
        ? String(locationFromId)
        : meta?.locationId != null
          ? String(meta.locationId)
          : null;

    // Определяем страну кандидата по локации
    const locForCountry =
      (locationFromId != null ? locationFromId : meta?.locationId) ?? null;
    const countryCode =
      locForCountry != null
        ? (byLocationCountry.get(locForCountry) ?? null)
        : null;

    // безопасное извлечение сигнатуры имени модели без any
    const rawModelNameA = (fy as { yachtModelName?: unknown }).yachtModelName;
    const rawModelNameB = (fy as { modelName?: unknown }).modelName;

    const competitorLabelRaw =
      fy?.yacht?.name ??
      fy?.yacht?.modelName ??
      (typeof rawModelNameA === 'string' ? rawModelNameA : null) ??
      (typeof rawModelNameB === 'string' ? rawModelNameB : null) ??
      null;

    const competitorYacht =
      (competitorLabelRaw ? String(competitorLabelRaw) : String(yachtIdNum)) ||
      String(yachtIdNum);

    candidates.push({
      competitorYacht,
      lengthFt,
      cabins,
      heads,
      year,
      marina,
      type: candidateTypeHint ?? null,
      countryCode,
      categoryId: null,
      builderId: null,
      price: Number(priceFinal),
      currency: String(fy?.price?.currency || 'EUR'),
      link: `nausys://freeYacht?id=${yachtIdNum}&from=${PERIOD_FROM}&to=${PERIOD_TO}`,
      raw: fy,
    });
  }

  return candidates;
}
