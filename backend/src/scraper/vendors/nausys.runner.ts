// backend/src/scraper/vendors/nausys.runner.ts

import { PrismaClient, ScrapeSource, JobStatus } from '@prisma/client';
import {
  getCharterBases,
  getYachtsByCompany,
  // getFreeYachts,
  getFreeYachtsSearch,
  ddmmyyyy,
  NauSysCreds,
  NauSysCharterBase,
  NauSysYacht,
  NauSysFreeYachtItem,
} from './nausys.client';

const prisma = new PrismaClient();

// ───────── Type guards + helpers (без any и без жёстких cast’ов)
function isCharterBase(v: unknown): v is NauSysCharterBase {
  const r = v as { companyId?: unknown };
  return r != null && typeof r.companyId === 'number';
}

function isYacht(v: unknown): v is NauSysYacht {
  const r = v as { id?: unknown };
  return r != null && typeof r.id === 'number';
}

function isFreeItem(v: unknown): v is NauSysFreeYachtItem {
  const r = v as { yachtId?: unknown };
  return r != null && typeof r.yachtId === 'number';
}

function pickArray<T>(val: unknown, guard: (u: unknown) => u is T): T[] {
  return Array.isArray(val) ? (val as unknown[]).filter(guard) : [];
}

// ─────────────────────────────────────────────────────────────
// Вспомогательные типы-обёртки под «двойной формат» NauSYS
// ─────────────────────────────────────────────────────────────
type BasesWrap = { bases?: unknown };
type YWrap = { yachts?: unknown };

// «расширенная» форма NauSysYacht без any
type NauSysYachtLoose = NauSysYacht &
  Partial<{
    yachtBuildYear: number;
    yachtCabins: number;
    heads: number;
    yachtHeads: number;
    length: number;
    yachtLengthMeters: number;
    baseLocationId: number;
  }>;

// вспомогательные утилиты
function num(v: unknown): number | null {
  if (v == null) return null;
  const n =
    typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

// function makeStableLink(yachtId: number, from: string, to: string): string {
//   return `nausys://freeYacht?id=${yachtId}&from=${from}&to=${to}`;
// }

// Делаем ссылку уникальной для каждой нашей target-яхты:
// nausys://freeYacht?id=...&from=...&to=...#target=<our-yacht-id>
function makeStableLink(
  yachtId: number,
  from: string,
  to: string,
  targetId: string,
): string {
  return `nausys://freeYacht?id=${yachtId}&from=${from}&to=${to}#target=${encodeURIComponent(
    targetId,
  )}`;
}

// ─────────────────────────────────────────────────────────────
// Тип и безопасный парсер ответа freeYachtsSearch
// ─────────────────────────────────────────────────────────────
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

function pickFreeSearchItems(resp: unknown): {
  items: NauSysFreeYachtItem[];
  currentPage: number;
  totalPages: number;
  totalCount: number | null;
  status: string | null;
} {
  const r = (resp ?? {}) as NauSysFreeYachtsSearchResponse;
  const arr = Array.isArray(r.freeYachtsInPeriod)
    ? r.freeYachtsInPeriod
    : // на случай других вариантов ключа у провайдера:
      (r as unknown as { freeYachts?: unknown })?.freeYachts;

  const items = pickArray(arr, isFreeItem);
  const currentPage =
    typeof r.currentPage === 'number' && Number.isFinite(r.currentPage)
      ? r.currentPage
      : 1;
  const totalPages =
    typeof r.totalPages === 'number' && Number.isFinite(r.totalPages)
      ? r.totalPages
      : 1;
  const totalCount =
    typeof r.totalCount === 'number' && Number.isFinite(r.totalCount)
      ? r.totalCount
      : null;
  const status = typeof r.status === 'string' ? r.status : null;
  return { items, currentPage, totalPages, totalCount, status };
}

// ─────────────────────────────────────────────────────────────
// Минимальный «кандидат» для фильтрации перед upsert
// (достаточно полей, которые обычно использует FiltersService.passes)
// ─────────────────────────────────────────────────────────────
export type NauSysCandidate = {
  competitorYacht: string;
  lengthFt: number | null;
  cabins: number | null;
  heads: number | null;
  year: number | null;
  marina: string | null;
  type: string | null; // можно прокинуть тип таргет-яхты снаружи
  countryCode: string | null; // в NauSYS не всегда есть — оставляем null
  categoryId: number | null; // n/a для NauSYS — null
  builderId: number | null; // n/a для NauSYS — null
  price: number;
  currency: string;
  link: string;
};

/**
 * Основная функция выполнения скрапинга NauSYS.
 * Аргументы: creds (логин/пароль), даты и jobId.
 */
export async function runNausysJob(params: {
  jobId: string;
  targetYachtId: string;
  creds: NauSysCreds;
  periodFrom: Date;
  periodTo: Date;
  /**
   * Необязательная функция-фильтр.
   * Если задана и вернула false — оффер НЕ будет сохранён.
   */
  accept?: (c: NauSysCandidate) => boolean;
  /**
   * Необязательный «тип» для кандидатов (обычно тип таргет-яхты: monohull/catamaran).
   * В свободных лодках NauSYS он не всегда присутствует.
   */
  candidateTypeHint?: string | null;
}) {
  const {
    jobId,
    targetYachtId,
    creds,
    periodFrom,
    periodTo,
    accept,
    candidateTypeHint = null,
  } = params;

  const weekStart = periodFrom; // Date в БД (DateTime)

  const PERIOD_FROM = ddmmyyyy(periodFrom);
  const PERIOD_TO = ddmmyyyy(periodTo);

  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: { status: JobStatus.RUNNING, startedAt: new Date() },
  });

  try {
    // 0) Полная замена за неделю перед апсертом
    await prisma.competitorPrice.deleteMany({
      where: {
        yachtId: targetYachtId,
        weekStart,
        source: ScrapeSource.NAUSYS,
      },
    });

    // 1) charterBases → companyIds
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

    if (companyIds.length === 0) {
      throw new Error('No companies found from charterBases()');
    }

    // 2) yachts by company (+ собираем метаданные по лодкам для обогащения)
    type YachtMeta = {
      year?: number | null;
      cabins?: number | null;
      heads?: number | null;
      lengthM?: number | null;
      locationId?: number | null; // базовая локация лодки
      modelId?: number | null; // yachtModelId (на будущее)
    };
    const byYachtMeta = new Map<number, YachtMeta>();

    const yachtIds: number[] = [];
    for (const companyIdRaw of companyIds) {
      const companyId = Number(companyIdRaw);
      if (!Number.isFinite(companyId)) {
        console.warn(`[NAUSYS] skip invalid companyId:`, companyIdRaw);
        continue;
      }

      const yRes = await getYachtsByCompany(creds, companyId);
      let yachts: NauSysYacht[] = pickArray(yRes, isYacht);
      if (yachts.length === 0) {
        const maybe = (yRes as YWrap)?.yachts;
        yachts = pickArray(maybe, isYacht);
      }

      yachts.forEach((yRaw) => {
        const y = yRaw as NauSysYachtLoose;

        const id = Number(y?.id);
        if (Number.isFinite(id)) yachtIds.push(id);

        // Мягко достаём метаданные, где бы они ни лежали
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

        if (
          meta.year != null ||
          meta.cabins != null ||
          meta.heads != null ||
          meta.lengthM != null ||
          meta.locationId != null ||
          meta.modelId != null
        ) {
          byYachtMeta.set(id, meta);
        }
      });

      console.log(`[NAUSYS] company ${companyId} → yachts: ${yachts.length}`);
    }

    if (yachtIds.length === 0) {
      throw new Error('No yachts found for given companies');
    }

    // 2b) Дотягиваем длину из локальной таблицы YachtModel (loa — метры)
    const modelIdsToFetch = Array.from(
      new Set(
        [...byYachtMeta.values()]
          .filter((m) => m.lengthM == null && typeof m.modelId === 'number')
          .map((m) => m.modelId!), // non-null после фильтра
      ),
    );

    const modelLenById = new Map<number, number>(); // modelId -> lengthM
    if (modelIdsToFetch.length > 0) {
      const models = await prisma.yachtModel.findMany({
        where: { nausysId: { in: modelIdsToFetch } },
        select: { nausysId: true, loa: true }, // loa — длина в метрах
      });
      for (const m of models) {
        const mid = Number(m.nausysId);
        const lenM = Number(m.loa);
        if (Number.isFinite(mid) && Number.isFinite(lenM) && lenM > 0) {
          modelLenById.set(mid, lenM);
        }
      }
    }

    // Обновляем meta длиной из модели
    if (modelLenById.size > 0) {
      for (const [yid, meta] of byYachtMeta) {
        if (meta.lengthM == null && typeof meta.modelId === 'number') {
          const lm = modelLenById.get(meta.modelId);
          if (lm != null) {
            meta.lengthM = lm;
            byYachtMeta.set(yid, meta);
          }
        }
      }
    }

    // 3) freeYachts — по батчам
    // const freeItems: NauSysFreeYachtItem[] = [];
    // const BATCH = 80;
    // for (let i = 0; i < uniqueYachtIds.length; i += BATCH) {
    //   const slice = uniqueYachtIds.slice(i, i + BATCH);
    //   const freeRes = await getFreeYachts(creds, {
    //     periodFrom: PERIOD_FROM,
    //     periodTo: PERIOD_TO,
    //     yachtIds: slice,
    //   });

    //   let freeArr: NauSysFreeYachtItem[] = pickArray(freeRes, isFreeItem);
    //   if (freeArr.length === 0) {
    //     const maybe = (freeRes as FWrap)?.freeYachts;
    //     freeArr = pickArray(maybe, isFreeItem);
    //   }
    //   freeItems.push(...freeArr);
    // }

    // 3) freeYachtsSearch — постраничная загрузка без списка yachtIds
    const freeItems: NauSysFreeYachtItem[] = [];
    {
      const RESULTS_PER_PAGE = 200;
      const MAX_PAGES = 50; // предохранитель
      let page = 1;

      while (page <= MAX_PAGES) {
        const resp = await getFreeYachtsSearch(creds, {
          periodFrom: PERIOD_FROM,
          periodTo: PERIOD_TO,
          countries: [], // без фильтра по странам
          resultsPerPage: RESULTS_PER_PAGE,
          resultsPage: page,
        });

        const {
          items: pageItems,
          currentPage,
          totalPages,
          totalCount,
          status,
        } = pickFreeSearchItems(resp);

        console.log(
          `[NAUSYS] search page=${currentPage}/${totalPages} status=${
            status ?? 'unknown'
          } totalCount=${totalCount ?? '?'} → items=${pageItems.length}`,
        );

        if (pageItems.length === 0) break; // пустая страница — конец
        freeItems.push(...pageItems);

        if (currentPage >= totalPages) break; // достигли конца
        page = currentPage + 1;
      }
    }
    console.log(`[NAUSYS] total freeYachts fetched=${freeItems.length}`);

    // 4) upsert competitor_prices
    let upserted = 0;
    for (const fy of freeItems) {
      const yachtIdNum = Number(fy?.yachtId);
      const priceFinal = num(fy?.price?.clientPrice);
      if (!priceFinal) continue;

      const link = makeStableLink(
        yachtIdNum,
        PERIOD_FROM,
        PERIOD_TO,
        targetYachtId,
      );
      const currency = String(fy?.price?.currency || 'EUR');

      const discountPct = (() => {
        const d = Array.isArray(fy?.price?.discounts) ? fy.price.discounts : [];
        const percents = d
          .map((x) => {
            const item = x as { amount?: number; value?: number };
            return num(item?.amount ?? item?.value);
          })
          .filter(
            (v): v is number => typeof v === 'number' && Number.isFinite(v),
          );
        if (percents.length > 0) return Math.max(...percents);
        const list = num(fy?.price?.priceListPrice);
        if (list && priceFinal) return ((list - priceFinal) / list) * 100;
        return null;
      })();

      // ── метаданные для фильтров
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

      // Марина: сначала из freeYachts, иначе — базовая локация из меты
      const locationFromId =
        (typeof fy?.locationFromId === 'number' ? fy.locationFromId : null) ??
        null;
      const marina =
        locationFromId != null
          ? String(locationFromId)
          : meta?.locationId != null
            ? String(meta.locationId)
            : null;

      // Удобочитаемое имя конкурента
      const competitorLabelRaw =
        fy?.yacht?.name ??
        fy?.yacht?.modelName ??
        fy?.yachtModelName ??
        fy?.modelName ??
        null;

      const competitorYacht =
        (competitorLabelRaw
          ? String(competitorLabelRaw)
          : String(yachtIdNum)) || String(yachtIdNum);

      // ── Сформируем «кандидата» для внешней фильтрации
      const candidate: NauSysCandidate = {
        competitorYacht,
        lengthFt,
        cabins,
        heads,
        year,
        marina,
        type: candidateTypeHint ?? null,
        countryCode: null,
        categoryId: null,
        builderId: null,
        price: priceFinal,
        currency,
        link,
      };

      // ⛔️ Если фильтр передан и не пропускает — пропускаем оффер
      if (typeof accept === 'function' && !accept(candidate)) {
        continue;
      }

      await prisma.competitorPrice.upsert({
        where: {
          source_link_weekStart: {
            source: ScrapeSource.NAUSYS,
            link,
            weekStart,
          },
        },
        update: {
          yachtId: targetYachtId,
          externalId: String(yachtIdNum), // сохраняем внешний ID
          competitorYacht: candidate.competitorYacht,
          price: candidate.price,
          currency: candidate.currency,
          discountPct,
          raw: fy,
          scrapeJobId: jobId,
          scrapedAt: new Date(),
          // поля для фильтров
          year: candidate.year ?? undefined,
          cabins: candidate.cabins ?? undefined,
          heads: candidate.heads ?? undefined,
          lengthFt: candidate.lengthFt ?? undefined,
          marina: candidate.marina ?? undefined,
        },
        create: {
          source: ScrapeSource.NAUSYS,
          weekStart,
          yachtId: targetYachtId,
          externalId: String(yachtIdNum), // сохраняем внешний ID
          competitorYacht: candidate.competitorYacht,
          price: candidate.price,
          currency: candidate.currency,
          link,
          raw: fy,
          discountPct,
          scrapeJobId: jobId,
          // поля для фильтров
          year: candidate.year ?? null,
          cabins: candidate.cabins ?? null,
          heads: candidate.heads ?? null,
          lengthFt: candidate.lengthFt ?? null,
          marina: candidate.marina ?? null,
        },
      });
      upserted++;
    }

    // 5) snapshot
    if (upserted > 0) {
      const rows = await prisma.competitorPrice.findMany({
        where: {
          yachtId: targetYachtId,
          weekStart,
          source: ScrapeSource.NAUSYS,
        },
        select: { price: true, currency: true },
        orderBy: { price: 'asc' },
      });

      if (rows.length > 0) {
        const prices = rows.map((r) => Number(r.price)).sort((a, b) => a - b);
        const top1 = prices[0];
        const top3Avg =
          Math.round(
            (prices.slice(0, 3).reduce((a, b) => a + b, 0) /
              Math.min(3, prices.length)) *
              100,
          ) / 100;

        await prisma.competitorSnapshot.upsert({
          where: {
            yachtId_weekStart_source: {
              yachtId: targetYachtId,
              weekStart,
              source: ScrapeSource.NAUSYS,
            },
          },
          create: {
            yachtId: targetYachtId,
            weekStart,
            source: ScrapeSource.NAUSYS,
            top1Price: top1,
            top3Avg,
            currency: rows[0].currency ?? 'EUR',
            sampleSize: prices.length,
            rawStats: { prices },
          },
          update: {
            top1Price: top1,
            top3Avg,
            currency: rows[0].currency ?? 'EUR',
            sampleSize: prices.length,
            rawStats: { prices },
            collectedAt: new Date(),
          },
        });
      }
    }

    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: { status: JobStatus.DONE, finishedAt: new Date() },
    });
    console.log(`[NAUSYS] job done: ${upserted} rows saved`);
  } catch (err: unknown) {
    const msg = (err as Error)?.message ?? String(err);
    console.error('[NAUSYS] failed:', msg);
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        finishedAt: new Date(),
        error: msg,
      },
    });
  }
}
