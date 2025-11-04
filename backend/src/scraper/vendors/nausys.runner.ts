// backend/src/scraper/vendors/nausys.runner.ts

import { PrismaClient, ScrapeSource, JobStatus } from '@prisma/client';
import { ddmmyyyy, NauSysCreds, NauSysFreeYachtItem } from './nausys.client';
import { collectNausysCandidates, ExtendedCandidate } from './nausys.collect';

const prisma = new PrismaClient();

// Утилита: делаем стабильную ссылку на оффер NauSYS + помечаем целевую яхту
// Пример: nausys://freeYacht?id=123&from=01.06.2025&to=08.06.2025#target=<UUID-нашей-яхты>
function makeStableLink(
  yachtId: number,
  from: string,
  to: string,
  targetId: string,
): string {
  return (
    `nausys://freeYacht?id=${yachtId}` +
    `&from=${from}&to=${to}` +
    `#target=${encodeURIComponent(targetId)}`
  );
}

// Вытаскиваем %скидки и т.п. из «сырых» данных NauSYS
function calcDiscountPctAndFees(raw: NauSysFreeYachtItem, finalPrice: number) {
  // discountPct:
  // 1) max из price.discounts[].amount/value если они есть
  // 2) или считаем (priceListPrice - clientPrice) / priceListPrice * 100
  // 3) иначе null
  let discountPct: number | null = null;

  const dArr = Array.isArray(raw?.price?.discounts) ? raw.price.discounts : [];

  const parsedPercents = dArr
    .map((x) => {
      const cand = x as { amount?: unknown; value?: unknown };
      const n =
        typeof cand.amount === 'number'
          ? cand.amount
          : typeof cand.value === 'number'
            ? cand.value
            : null;
      return typeof n === 'number' && Number.isFinite(n) ? n : null;
    })
    .filter((v): v is number => v !== null);

  if (parsedPercents.length > 0) {
    discountPct = Math.max(...parsedPercents);
  } else {
    const listPrice =
      typeof raw?.price?.priceListPrice === 'number'
        ? raw.price.priceListPrice
        : null;
    if (
      listPrice != null &&
      Number.isFinite(listPrice) &&
      listPrice > 0 &&
      Number.isFinite(finalPrice)
    ) {
      discountPct = ((listPrice - finalPrice) / listPrice) * 100;
    }
  }

  // feesTotal:
  // мы пока не тащим сборы (чистка/турист.налог и т.д.) детально,
  // поэтому оставляем null как placeholder
  const feesTotal: number | null = null;

  return { discountPct, feesTotal };
}

/**
 * Основная функция выполнения скрапинга NauSYS.
 *
 * - jobId: ID строки в ScrapeJob
 * - targetYachtId: наша яхта (UUID) для которой ищем конкурентов
 * - creds: логи/пароль NauSYS
 * - periodFrom/periodTo: неделя чартерная (даты)
 * - accept: опциональный фильтр (можем дропнуть кандидата до записи)
 * - candidateTypeHint: можем подсунуть тип корпуса ("monohull"/"catamaran"),
 *   он прокинется во всех кандидатах.
 */
export async function runNausysJob(params: {
  jobId: string;
  targetYachtId: string;
  creds: NauSysCreds;
  periodFrom: Date; // суббота недели
  periodTo: Date; // следующая суббота
  accept?: (c: ExtendedCandidate) => boolean;
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

  const weekStart = periodFrom; // Date хранится как DateTime в CompetitorPrice.weekStart

  // Формат dd.mm.yyyy для линка в стиле nausys://freeYacht?id=..&from=..&to=..
  const PERIOD_FROM = ddmmyyyy(periodFrom);
  const PERIOD_TO = ddmmyyyy(periodTo);

  // 1. Переводим ScrapeJob в RUNNING
  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  try {
    // 2. Чистим старые строки на эту неделю (чтобы не было хвостов)
    await prisma.competitorPrice.deleteMany({
      where: {
        yachtId: targetYachtId,
        weekStart,
        source: ScrapeSource.NAUSYS,
      },
    });

    // 3. Собираем кандидатов через наш новый, умный коллектор.
    //    Он уже:
    //    - стягивает freeYachtsSearch постранично,
    //    - мапит locationId -> Country (через Location/Region/Country),
    //    - нормализует длину, каюты, год, марину,
    //    - подставляет countryId, countryCode.
    const candidates = await collectNausysCandidates({
      creds,
      periodFrom,
      periodTo,
      candidateTypeHint,
    });

    let upserted = 0;

    // 4. Гоним по кандидатам → фильтр accept() → upsert в competitor_prices
    for (const cand of candidates) {
      // accept() может сказать "не сохраняй"
      if (typeof accept === 'function' && !accept(cand)) {
        continue;
      }

      // cand.raw – это NauSysFreeYachtItem
      const raw: NauSysFreeYachtItem = cand.raw;

      // В NauSYS ID лодки – cand.raw.yachtId (number)
      const yachtIdNum = typeof raw?.yachtId === 'number' ? raw.yachtId : null;
      if (yachtIdNum == null || !Number.isFinite(yachtIdNum)) {
        continue;
      }

      // Цена кандидата (в collectNausysCandidates мы уже клали в cand.price)
      const finalPrice = cand.price;
      if (!(typeof finalPrice === 'number' && Number.isFinite(finalPrice))) {
        continue;
      }

      // Валюта кандидата
      const currency = cand.currency ?? 'EUR';

      // Посчитаем discountPct / feesTotal из сырых данных одной лодки:
      const { discountPct, feesTotal } = calcDiscountPctAndFees(
        raw,
        finalPrice,
      );

      // Линк. (в collect мы кладём что-то вроде nausys://freeYacht?id=123&from=..&to=..)
      // Но нам нужен стабильный линк с таргет-яхтой (для @@unique и снапшота),
      // поэтому делаем свой:
      const link = makeStableLink(
        yachtIdNum,
        PERIOD_FROM,
        PERIOD_TO,
        targetYachtId,
      );

      // competitorYacht: уже читабельная подпись лодки конкурента
      const competitorYacht = cand.competitorYacht || String(yachtIdNum);

      // upsert в competitor_prices
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
          externalId: String(yachtIdNum),

          competitorYacht,
          price: finalPrice,
          currency,

          discountPct: discountPct ?? undefined,
          feesTotal: feesTotal ?? undefined,

          raw, // сохраняем целиком NauSYS-ответ в JSON
          scrapeJobId: jobId,
          scrapedAt: new Date(),

          // поля для фильтров / аналитики
          year: cand.year ?? undefined,
          cabins: cand.cabins ?? undefined,
          heads: cand.heads ?? undefined,
          lengthFt: cand.lengthFt ?? undefined,
          marina: cand.marina ?? undefined,

          // 👇 ВАЖНО: страна конкурента
          countryId: cand.countryId ?? undefined,
          countryCode: cand.countryCode ?? undefined,

          // 👇 НОВОЕ: измерения для нормальной работы фильтров
          // (ожидаем, что ExtendedCandidate уже содержит наши FK-ID)
          categoryId: cand.categoryId ?? undefined,
          builderId: cand.builderId ?? undefined,
          modelId: cand.modelId ?? undefined,
          regionId: cand.regionId ?? undefined,
          locationId: cand.locationId ?? undefined,
        },
        create: {
          source: ScrapeSource.NAUSYS,
          weekStart,
          yachtId: targetYachtId,
          externalId: String(yachtIdNum),

          competitorYacht,
          price: finalPrice,
          currency,

          link,
          raw,
          scrapeJobId: jobId,

          discountPct: discountPct ?? null,
          feesTotal: feesTotal ?? null,

          // поля для фильтров / аналитики
          year: cand.year ?? null,
          cabins: cand.cabins ?? null,
          heads: cand.heads ?? null,
          lengthFt: cand.lengthFt ?? null,
          marina: cand.marina ?? null,

          // 👇 пишем и UUID страны, и ISO-2
          countryId: cand.countryId ?? null,
          countryCode: cand.countryCode ?? null,

          // 👇 НОВОЕ: FK по измерениям
          categoryId: cand.categoryId ?? null,
          builderId: cand.builderId ?? null,
          modelId: cand.modelId ?? null,
          regionId: cand.regionId ?? null,
          locationId: cand.locationId ?? null,
        },
      });

      upserted++;
    }

    // 5. Пересчитать snapshot (top1, top3avg) по этой неделе для этой яхты
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
        const prices = rows
          .map((r) => Number(r.price))
          .filter((n) => Number.isFinite(n))
          .sort((a, b) => a - b);

        if (prices.length > 0) {
          const top1 = prices[0];
          const denom = Math.min(3, prices.length);
          const top3AvgRaw =
            prices.slice(0, 3).reduce((acc, n) => acc + n, 0) / denom;
          const top3Avg = Math.round(top3AvgRaw * 100 /* cents */) / 100;

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
    }

    // 6. ScrapeJob → DONE
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.DONE,
        finishedAt: new Date(),
      },
    });

    console.log(
      `[NAUSYS] job ${jobId} done: saved ${targetYachtId} / week ${PERIOD_FROM} → upserted rows.`,
    );
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);

    console.error('[NAUSYS] job failed:', msg);

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
