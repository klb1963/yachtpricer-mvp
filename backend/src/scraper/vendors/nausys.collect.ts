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
import { NauSysCandidate } from './nausys.types';

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

// Расширенный кандидат, который вернём наружу:
// добавляем страну конкурента (и raw из NauSYS) + новые FK.
export type ExtendedCandidate = NauSysCandidate & {
  countryId: string | null;
  countryCode: string | null;
  raw: NauSysFreeYachtItem;
  // новые измерения для CompetitorPrice
  modelId: number | null; // PK YachtModel.id
  regionId: number | null; // PK Region.id
  locationId: string | null; // PK Location.id (cuid)
};

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
}): Promise<ExtendedCandidate[]> {
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
  // Сбор метаданных по яхтам (ниже) даст нам locationId для каждой лодки.
  // После этого мы построим МАПУ:
  //    NauSYS locationId (number) -> { countryId(UUID), countryCode(ISO-2) }
  //
  // Эта мапа будет основана НЕ на угадывании текста, а на наших таблицах
  // Location / Region / Country в БД.
  // ───────────────────────────────────────────────────────────────
  //
  // Шаг 1 (ниже в коде): соберём byYachtMeta с locationId для каждой яхты.
  // Шаг 2 (после того как заполним byYachtMeta): вытащим все уникальные locationId
  // и спросим Prisma о них.
  //
  // В итоге получим:
  //   const byLocationCountryInfo = Map<number, { countryId: string; countryCode: string }>
  // и будем пользоваться ей при формировании кандидатов.

  // 2) yachts by company → собираем мету (год/каюты/длина/локация/модель)
  type YachtMeta = {
    year?: number | null;
    cabins?: number | null;
    heads?: number | null;
    lengthM?: number | null;
    locationId?: number | null;
    modelNausysId?: number | null; // NauSYS modelId (yachtModelId)
    // PK из справочников
    modelId?: number | null; // YachtModel.id
    categoryId?: number | null; // YachtCategory.id
    builderId?: number | null; // YachtBuilder.id
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
        modelNausysId:
          typeof y?.yachtModelId === 'number' ? y.yachtModelId : null,
      };
      byYachtMeta.set(id, meta);
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Сформируем список всех locationId, которые встретились в метаданных лодок.
  // Это NauSYS IDs (числа), мы будем искать им соответствие в нашей таблице Location.
  // ───────────────────────────────────────────────────────────────
  const allLocationIds = Array.from(
    new Set(
      [...byYachtMeta.values()]
        .map((m) => (typeof m.locationId === 'number' ? m.locationId : null))
        .filter((v): v is number => v !== null),
    ),
  );

  // Если локаций нет вообще — то карта стран будет пустой.
  const byLocationCountryInfo = new Map<
    number,
    {
      countryId: string | null;
      countryCode: string | null;
      locationId: string | null; // PK Location.id
      regionId: number | null; // PK Region.id
    }
  >();

  if (allLocationIds.length > 0) {
    // Жёстко описываем ожидаемую форму строки Location из Prisma.
    type LocRow = {
      externalId: string | null; // NauSYS locationId (как строка)
      id: string; // PK Location.id (cuid)
      regionId: number | null; // FK на Region.id
      countryId: string | null; // UUID нашей Country или null
      country: {
        id: string;
        code2: string | null;
      } | null;
      region: {
        id: number;
        countryId: string | null;
        country: {
          id: string;
          code2: string | null;
        } | null;
      } | null;
    };

    const dbLocations = (await prisma.location.findMany({
      where: {
        source: 'NAUSYS',
        // ВАЖНО: externalId в схеме Location — строка,
        // а allLocationIds это number[].
        // Значит, сначала делаем массив строк.
        externalId: { in: allLocationIds.map(String) },
      },
      select: {
        externalId: true, // string | null
        id: true,
        regionId: true,
        countryId: true, // string | null
        country: {
          select: {
            id: true, // string
            code2: true, // string | null
          },
        },
        region: {
          select: {
            countryId: true, // string | null
            country: {
              select: {
                id: true, // string
                code2: true, // string | null
              },
            },
          },
        },
      },
    })) as unknown as LocRow[];

    // безопасный апперкас для ISO-2
    const toUpper2 = (v: unknown): string | null => {
      return typeof v === 'string' && v.length > 0 ? v.toUpperCase() : null;
    };

    for (const loc of dbLocations) {
      // 1. вытащить NauSYS locationId => number
      let extIdNum: number | null = null;
      const extVal: unknown = loc.externalId;
      if (typeof extVal === 'number' && Number.isFinite(extVal)) {
        extIdNum = extVal;
      } else if (typeof extVal === 'string') {
        const parsed = Number(extVal);
        if (Number.isFinite(parsed)) {
          extIdNum = parsed;
        }
      }
      if (extIdNum === null) {
        continue;
      }

      // 2. Прямая страна с Location
      const directCountryId: string | null =
        loc.countryId ?? (loc.country ? loc.country.id : null);
      const directCountryCode: string | null = toUpper2(
        loc.country ? loc.country.code2 : null,
      );

      // 3. fallback через Region
      const regionCountryId: string | null =
        (loc.region ? loc.region.countryId : null) ??
        (loc.region && loc.region.country ? loc.region.country.id : null);
      const regionCountryCode: string | null = toUpper2(
        loc.region && loc.region.country ? loc.region.country.code2 : null,
      );

      // 4. locationId / regionId – наши PK для CompetitorPrice
      const finalLocationId: string | null = loc.id ?? null;
      const finalRegionId: number | null =
        (loc.region ? loc.region.id : null) ?? loc.regionId ?? null;

      // 5. финальные значения
      const finalCountryId: string | null =
        directCountryId ?? regionCountryId ?? null;
      const finalCountryCode: string | null =
        directCountryCode ?? regionCountryCode ?? null;

      byLocationCountryInfo.set(extIdNum, {
        countryId: finalCountryId,
        countryCode: finalCountryCode,
        locationId: finalLocationId,
        regionId: finalRegionId,
      });
    }
  }

  // 2b) если не хватает длины → подтянем из локальной YachtModel (loa — метры)
  const needModelIds = Array.from(
    new Set(
      [...byYachtMeta.values()]
        .filter((m) => m.lengthM == null && typeof m.modelNausysId === 'number')
        .map((m) => m.modelNausysId!),
    ),
  );
  if (needModelIds.length > 0) {
    const models = await prisma.yachtModel.findMany({
      where: { nausysId: { in: needModelIds } },
      select: {
        id: true,
        nausysId: true,
        loa: true,
        categoryId: true,
        builderId: true,
      },
    });
    const modelMap = new Map<
      number,
      {
        lengthM: number | null;
        modelId: number;
        categoryId: number | null;
        builderId: number | null;
      }
    >();
    for (const m of models) {
      const mid = Number(m.nausysId);
      const lenM = m.loa != null ? Number(m.loa) : NaN;
      if (!Number.isFinite(mid)) continue;

      modelMap.set(mid, {
        lengthM: Number.isFinite(lenM) && lenM > 0 ? lenM : null,
        modelId: m.id,
        categoryId: m.categoryId ?? null,
        builderId: m.builderId ?? null,
      });
    }
    for (const [, meta] of byYachtMeta) {
      if (typeof meta.modelNausysId !== 'number') continue;
      const info = modelMap.get(meta.modelNausysId);
      if (!info) continue;

      // длина
      if (meta.lengthM == null && info.lengthM != null) {
        meta.lengthM = info.lengthM;
      }
      // наши PK
      meta.modelId = info.modelId;
      meta.categoryId = info.categoryId;
      meta.builderId = info.builderId;
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
  const candidates: ExtendedCandidate[] = [];
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

    // Шаг страны:
    // берем NauSYS locationId (locationFromId || meta.locationId),
    // и смотрим в byLocationCountryInfo → { countryId, countryCode }
    const locForCountryId =
      (locationFromId != null ? locationFromId : meta?.locationId) ?? null;

    let countryId: string | null = null;
    let countryCode: string | null = null;
    let locationIdPk: string | null = null;
    let regionIdPk: number | null = null;
    if (locForCountryId != null) {
      const cInfo = byLocationCountryInfo.get(locForCountryId);
      if (cInfo) {
        countryId = cInfo.countryId ?? null;
        countryCode = cInfo.countryCode ?? null;
        locationIdPk = cInfo.locationId ?? null;
        regionIdPk = cInfo.regionId ?? null;
      }
    }

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
      // FK из YachtModel / YachtCategory / YachtBuilder
      categoryId: meta?.categoryId ?? null,
      builderId: meta?.builderId ?? null,
      modelId: meta?.modelId ?? null,
      // FK из Location / Region
      regionId: regionIdPk,
      locationId: locationIdPk,
      price: Number(priceFinal),
      currency: String(fy?.price?.currency || 'EUR'),
      link: `nausys://freeYacht?id=${yachtIdNum}&from=${PERIOD_FROM}&to=${PERIOD_TO}`,

      // новые поля, которые требуют тип ExtendedCandidate
      countryId: countryId ?? null,
      countryCode: countryCode ?? null,

      // raw обязателен тоже
      raw: fy,
    });
  }

  return candidates;
}
