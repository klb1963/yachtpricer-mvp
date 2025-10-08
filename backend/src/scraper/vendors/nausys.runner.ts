// backend/src/scraper/vendors/nausys.runner.ts
import { PrismaClient, ScrapeSource, JobStatus } from '@prisma/client';
import {
  getCharterBases,
  getYachtsByCompany,
  getFreeYachts,
  getYachtModel,
  ddmmyyyy,
  NauSysCreds,
} from './nausys.client';

const prisma = new PrismaClient();

// вспомогательные утилиты
function num(v: unknown): number | null {
  if (v == null) return null;
  const n =
    typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function makeStableLink(yachtId: number, from: string, to: string): string {
  return `nausys://freeYacht?id=${yachtId}&from=${from}&to=${to}`;
}

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
}) {
  const { jobId, targetYachtId, creds, periodFrom, periodTo } = params;
  const weekStart = periodFrom;

  const PERIOD_FROM = ddmmyyyy(periodFrom);
  const PERIOD_TO = ddmmyyyy(periodTo);

  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: { status: JobStatus.RUNNING, startedAt: new Date() },
  });

  try {
    // 0) “полная замена за неделю”, строго актуальный срез перед циклом upsert-ов, сразу после расчёта weekStart/periodFrom/To:
    await prisma.competitorPrice.deleteMany({
      where: {
        yachtId: targetYachtId,
        weekStart,
        source: ScrapeSource.NAUSYS,
      },
    });

    // 1) charterBases → companyIds
    const basesRes = await getCharterBases(creds);
    const companyIds = Array.from(
      new Set(
        (basesRes?.bases ?? [])
          .map((b: any) => Number(b?.companyId))
          .filter(
            (v: unknown): v is number =>
              typeof v === 'number' && Number.isFinite(v),
          ),
      ),
    );

    if (companyIds.length === 0)
      throw new Error('No companies found from charterBases()');

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
      const yachts = Array.isArray(yRes?.yachts) ? yRes.yachts : [];

      yachts.forEach((y: any) => {
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
          modelId:
            (typeof y?.yachtModelId === 'number' ? y.yachtModelId : null) ??
            null,
        };
        // Запишем, только если что-то полезное есть
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

    const uniqueYachtIds = Array.from(new Set(yachtIds));
    if (uniqueYachtIds.length === 0)
      throw new Error('No yachts found for given companies');

    // ───────────────────────────────────────────────────────────
    // 2b) ДОТЯГИВАЕМ длину из локальной таблицы YachtModel (loa — метры)
    // ───────────────────────────────────────────────────────────
    const modelIdsToFetch = Array.from(
      new Set(
        [...byYachtMeta.values()]
          .filter(m => (m.lengthM == null) && (typeof m.modelId === 'number'))
          .map(m => m.modelId!) // non-null после фильтра
      )
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
    const freeItems: any[] = [];
    const BATCH = 80;
    for (let i = 0; i < uniqueYachtIds.length; i += BATCH) {
      const slice = uniqueYachtIds.slice(i, i + BATCH);
      const freeRes = await getFreeYachts(creds, {
        periodFrom: PERIOD_FROM,
        periodTo: PERIOD_TO,
        yachtIds: slice,
      });
      const arr = Array.isArray(freeRes?.freeYachts) ? freeRes.freeYachts : [];
      freeItems.push(...arr);
    }

    // 4) upsert competitor_prices
    let upserted = 0;
    for (const fy of freeItems) {
      const yachtIdNum = Number(fy?.yachtId);
      const priceFinal = num(fy?.price?.clientPrice);
      if (!priceFinal) continue;

      const link = makeStableLink(yachtIdNum, PERIOD_FROM, PERIOD_TO);
      const currency = String(fy?.price?.currency || 'EUR');

      const discountPct = (() => {
        const d = Array.isArray(fy?.price?.discounts) ? fy.price.discounts : [];
        const percents = d
          .map((x: any) => num(x?.amount))
          .filter(
            (v: unknown): v is number =>
              typeof v === 'number' && Number.isFinite(v),
          );
        if (percents.length > 0) return Math.max(...percents);
        const list = num(fy?.price?.priceListPrice);
        if (list && priceFinal) return ((list - priceFinal) / list) * 100;
        return null;
      })();

      // ── NEW: метаданные для фильтров
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

      // Попробуем собрать удобочитаемое имя конкурента
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
          competitorYacht,
          price: priceFinal,
          currency,
          discountPct,
          raw: fy,
          scrapeJobId: jobId,
          scrapedAt: new Date(),
          // NEW: поля для фильтров
          year: year ?? undefined,
          cabins: cabins ?? undefined,
          heads: heads ?? undefined,
          lengthFt: lengthFt ?? undefined,
          marina: marina ?? undefined,
        },
        create: {
          source: ScrapeSource.NAUSYS,
          weekStart,
          yachtId: targetYachtId,
          competitorYacht,
          price: priceFinal,
          currency,
          link,
          raw: fy,
          discountPct,
          scrapeJobId: jobId,
          // NEW
          year: year ?? null,
          cabins: cabins ?? null,
          heads: heads ?? null,
          lengthFt: lengthFt ?? null,
          marina: marina ?? null,
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
  } catch (err: any) {
    console.error('[NAUSYS] failed:', err?.message || err);
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        finishedAt: new Date(),
        error: String(err?.message || err),
      },
    });
  }
}