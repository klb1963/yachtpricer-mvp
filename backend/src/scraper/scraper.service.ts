// backend/src/scraper/scraper.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartScrapeDto, AggregateDto } from './scraper.dto';
import {
  Prisma,
  JobStatus,
  ScrapeSource as PrismaScrapeSource,
  type ScrapeJob,
} from '@prisma/client';

/** Нормализует дату к началу чартерной недели (суббота 00:00 UTC). */
function getCharterWeekStartSaturdayUTC(input: Date): Date {
  const d = new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()),
  );
  const day = d.getUTCDay();
  const diff = (day - 6 + 7) % 7; // до субботы
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Преобразует DTO в JSON для ScrapeJob.params (null вместо undefined). */
function dtoToJson(dto: StartScrapeDto): Prisma.InputJsonObject {
  return {
    yachtId: dto.yachtId ?? null,
    weekStart: dto.weekStart ?? null,
    location: dto.location ?? null,
    type: dto.type ?? null,
    minYear: dto.minYear ?? null,
    maxYear: dto.maxYear ?? null,
    minLength: dto.minLength ?? null,
    maxLength: dto.maxLength ?? null,
    people: dto.people ?? null,
    cabins: dto.cabins ?? null,
    heads: dto.heads ?? null,
    source: dto.source ?? 'BOATAROUND',
  };
}

// ===== helpers для фильтров

const M_TO_FT = 3.28084;
const toFeet = (meters: number | null | undefined) =>
  typeof meters === 'number' && Number.isFinite(meters)
    ? meters * M_TO_FT
    : undefined;

function lengthFtTolerance(targetFt: number | undefined) {
  if (!targetFt) return 2;
  if (targetFt < 40) return 1;
  if (targetFt <= 50) return 2;
  return 3;
}

function passesBusinessFilters(
  candidate: {
    lengthFt?: number | null;
    cabins?: number | null;
    heads?: number | null;
    year?: number | null;
    marina?: string | null;
  },
  ctx: {
    targetLenFt?: number; // больше НЕ используем для отсечения по длине
    dto: StartScrapeDto;
  },
) {
  const { dto } = ctx;

  // 1) Длина (ft) — фильтруем только если dto.minLength/maxLength заданы (в метрах)
  if (
    (typeof dto.minLength === 'number' || typeof dto.maxLength === 'number') &&
    candidate.lengthFt != null
  ) {
    const minFt =
      typeof dto.minLength === 'number' ? dto.minLength * M_TO_FT : -Infinity;
    const maxFt =
      typeof dto.maxLength === 'number' ? dto.maxLength * M_TO_FT : Infinity;
    if (candidate.lengthFt < minFt || candidate.lengthFt > maxFt) return false;
  }

  // 2) Cabins (если заданы — точное совпадение)
  if (typeof dto.cabins === 'number' && candidate.cabins != null) {
    if (candidate.cabins !== dto.cabins) return false;
  }

  // 3) Heads (если заданы) — допускаем >=
  if (typeof dto.heads === 'number' && candidate.heads != null) {
    if (candidate.heads < dto.heads) return false;
  }

  // 4) Год постройки
  if (typeof dto.minYear === 'number' && candidate.year != null) {
    if (candidate.year < dto.minYear) return false;
  }
  if (typeof dto.maxYear === 'number' && candidate.year != null) {
    if (candidate.year > dto.maxYear) return false;
  }

  // 5) Локация: простая проверка вхождения
  if (dto.location && candidate.marina) {
    const a = candidate.marina.toLowerCase();
    const b = String(dto.location).toLowerCase();
    if (!a.includes(b)) return false;
  }

  return true;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Старт скрейпа (заглушка генерации карточек). */
  async start(
    dto: StartScrapeDto,
  ): Promise<{ jobId: string; status: JobStatus }> {
    const sourceEnum =
      PrismaScrapeSource[
        (dto.source ?? 'BOATAROUND') as keyof typeof PrismaScrapeSource
      ];

    const job: ScrapeJob = await this.prisma.scrapeJob.create({
      data: {
        source: sourceEnum,
        params: dtoToJson(dto),
        status: JobStatus.PENDING,
      },
    });

    try {
      this.logger.log(`[${job.id}] set RUNNING`);
      await this.prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: JobStatus.RUNNING, startedAt: new Date() },
      });

      const base = dto.weekStart ? new Date(dto.weekStart) : new Date();
      const weekStart = getCharterWeekStartSaturdayUTC(base);

      // FK и целевая длина (targetLenFt оставлен, но не участвует в фильтре длины по умолчанию)
      let yachtIdForInsert: string | undefined;
      let targetLenFt: number | undefined;
      if (dto.yachtId) {
        const y = await this.prisma.yacht.findUnique({
          where: { id: dto.yachtId },
        });
        if (y) {
          yachtIdForInsert = dto.yachtId;
          targetLenFt = toFeet(y.length);
        } else {
          this.logger.warn(
            `[${job.id}] yachtId ${dto.yachtId} not found — write without FK`,
          );
        }
      }

      // Заглушка кандидатов
      const rawCandidates = [
        {
          competitorYacht: 'Bavaria 46 2019 (Demo)',
          lengthFt: 46,
          cabins: 4,
          heads: 2,
          year: 2019,
          marina: 'HR - Marina Kaštela',
          price: new Prisma.Decimal(4800),
          currency: 'EUR',
          link: 'https://example.com/boat1',
        },
        {
          competitorYacht: 'Beneteau Oceanis 36 (Demo)',
          lengthFt: 36,
          cabins: 3,
          heads: 1,
          year: 2012,
          marina: 'HR - Split',
          price: new Prisma.Decimal(3200),
          currency: 'EUR',
          link: 'https://example.com/boat2',
        },
      ];

      const filtered = rawCandidates.filter((c) =>
        passesBusinessFilters(
          {
            lengthFt: c.lengthFt,
            cabins: c.cabins,
            heads: c.heads,
            year: c.year,
            marina: c.marina,
          },
          { targetLenFt, dto },
        ),
      );

      this.logger.log(
        `[${job.id}] candidates=${rawCandidates.length} filtered=${filtered.length} (${weekStart.toISOString()})`,
      );

      // ===== устойчивые вставки: upsert по @@unique([source, link, weekStart])
      const yachtIdToWrite = yachtIdForInsert ?? dto.yachtId ?? null;
      let upserts = 0;

      for (const c of filtered) {
        await this.prisma.competitorPrice.upsert({
          where: {
            // имя составного unique-ключа генерится Prisma как <field1>_<field2>_<field3>
            source_link_weekStart: {
              source: sourceEnum,
              link: c.link,
              weekStart,
            },
          },
          create: {
            yachtId: yachtIdToWrite,
            weekStart,
            source: sourceEnum,
            competitorYacht: c.competitorYacht,
            price: c.price,
            currency: c.currency,
            link: c.link,
            scrapedAt: new Date(),
            lengthFt: c.lengthFt,
            cabins: c.cabins,
            heads: c.heads,
            year: c.year,
            marina: c.marina,
            scrapeJobId: job.id,
          },
          update: {
            yachtId: yachtIdToWrite ?? undefined, // если раньше был NULL — пришьём к лодке
            price: c.price,
            currency: c.currency,
            scrapedAt: new Date(),
            lengthFt: c.lengthFt,
            cabins: c.cabins,
            heads: c.heads,
            year: c.year,
            marina: c.marina,
            scrapeJobId: job.id,
          },
        });
        upserts++;
      }

      if (upserts === 0) {
        this.logger.warn(`[${job.id}] no candidates passed filters`);
      } else {
        this.logger.log(`[${job.id}] upserted competitorPrice rows: ${upserts}`);
      }
      // ===== конец устойчивых вставок

      await this.prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: JobStatus.DONE, finishedAt: new Date() },
      });
      this.logger.log(`[${job.id}] job DONE`);
    } catch (err) {
      this.logger.error(`[${job.id}] job FAILED`, err);
      await this.prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          finishedAt: new Date(),
          error: String(err),
        },
      });
    }

    return { jobId: job.id, status: job.status };
  }

  /** Статус job. */
  async status(jobId: string) {
    return this.prisma.scrapeJob.findUnique({ where: { id: jobId } });
  }

  /** Сырые цены по фильтрам. */
  async getCompetitors(q: { yachtId?: string; week?: string }) {
    let weekFilter: Prisma.CompetitorPriceWhereInput = {};
    if (q.week) {
      const base = new Date(q.week);
      const weekStart = getCharterWeekStartSaturdayUTC(base);
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
      weekFilter = { weekStart: { gte: weekStart, lt: weekEnd } };
    }

    return this.prisma.competitorPrice.findMany({
      where: { ...(q.yachtId ? { yachtId: q.yachtId } : {}), ...weekFilter },
      orderBy: [{ scrapedAt: 'desc' }],
      take: 50,
    });
  }

  /** Агрегирует CompetitorPrice → CompetitorSnapshot. */
  async aggregate(dto: AggregateDto) {
    // 1) Нормализуем неделю
    const base = new Date(dto.week);
    const weekStart = getCharterWeekStartSaturdayUTC(base);

    // 2) Источник -> prisma enum
    const srcKey = (dto.source ??
      'BOATAROUND') as keyof typeof PrismaScrapeSource;
    const source: PrismaScrapeSource = PrismaScrapeSource[srcKey];

    // 3) Берём цены для yacht×week×source
    const prices = await this.prisma.competitorPrice.findMany({
      where: { yachtId: dto.yachtId, weekStart, source },
      orderBy: { price: 'asc' },
    });

    if (prices.length === 0) {
      this.logger.warn(
        `[aggregate] no data: yacht=${dto.yachtId}, week=${weekStart.toISOString()}, source=${source}`,
      );
      return null;
    }

    // 4) Агрегаты
    const top1 = prices[0].price; // Prisma.Decimal
    const top3Nums = prices.slice(0, 3).map((p) => Number(p.price));
    const top3AvgNum =
      top3Nums.reduce((s, v) => s + v, 0) / Math.max(top3Nums.length, 1);
    const top3Avg = new Prisma.Decimal(top3AvgNum.toFixed(2)); // Prisma.Decimal

    // 4.1) JSON-совместимый срез для rawStats
    const rawStats: Prisma.InputJsonValue = prices.map((p) => ({
      id: p.id,
      price: Number(p.price),
      currency: p.currency,
      link: p.link,
      lengthFt: p.lengthFt ?? null,
      cabins: p.cabins ?? null,
      heads: p.heads ?? null,
      year: p.year ?? null,
      marina: p.marina ?? null,
      scrapedAt: p.scrapedAt ? p.scrapedAt.toISOString() : null,
    })) as Prisma.InputJsonValue;

    // 5) Upsert снапшота
    const snapshot = await this.prisma.competitorSnapshot.upsert({
      where: {
        yachtId_weekStart_source: { yachtId: dto.yachtId, weekStart, source },
      },
      create: {
        yachtId: dto.yachtId,
        weekStart,
        source,
        top1Price: top1,
        top3Avg,
        currency: prices[0].currency,
        sampleSize: prices.length,
        rawStats,
      },
      update: {
        top1Price: top1,
        top3Avg,
        currency: prices[0].currency,
        sampleSize: prices.length,
        rawStats,
        collectedAt: new Date(),
      },
    });

    this.logger.log(
      `[aggregate] OK: yacht=${dto.yachtId}, week=${weekStart.toISOString()}, source=${source}, sampleSize=${prices.length}`,
    );

    return snapshot;
  }
}