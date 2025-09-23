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
import { FiltersService } from './filter/filters.service';

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

// ====================

// ====================

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filters: FiltersService,
  ) {
    this.logger.log('✅ ScraperService initialized (NEW BUILD)');
  }

  /** Старт скрейпа (генерация «конкурентов» из нашей БД вместо моков). */
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

      // FK и целевая длина (оставлено для совместимости)
      let yachtIdForInsert: string | undefined;
      let targetLenFt: number | undefined;
      if (dto.yachtId) {
        const y = await this.prisma.yacht.findUnique({
          where: { id: dto.yachtId },
        });
        if (y) {
          yachtIdForInsert = dto.yachtId;
          // нормализуем длину через FiltersService
          targetLenFt =
            this.filters.normalizeLengthToFeet(y.length) ?? undefined;
        } else {
          this.logger.warn(
            `[${job.id}] yachtId ${dto.yachtId} not found — write without FK`,
          );
        }
      }

      // ───────────────────────────────────────────────────────────────
      // Реальные «конкуренты» из нашей БД
      // ───────────────────────────────────────────────────────────────
      const target = dto.yachtId
        ? await this.prisma.yacht.findUnique({ where: { id: dto.yachtId } })
        : null;

      // загрузить конфиг фильтров (ORG-уровень; userId можно пробросить позже)
      await this.filters.loadConfig(this.prisma, {
        orgId: target?.orgId ?? null,
        userId: null,
      });

      const eff: StartScrapeDto = { ...dto };
      if (target) {
        // тип у Prisma сгенерирован строго, так что можно напрямую
        eff.type ??= target.type ?? undefined;
        eff.location ??= target.location ?? undefined;

        // ВНИМАНИЕ: eff.* не влияет на фильтрацию — фильтры берут исходный dto (в ФУТАХ).
        // Этот блок оставлен для совместимости/дальнейшего расширения и не используется при отборе.
        if (
          typeof eff.minLength !== 'number' &&
          typeof eff.maxLength !== 'number'
        ) {
          const L = Number(target.length) || 0;
          eff.minLength = Math.max(0, L - 1);
          eff.maxLength = L + 1;
        }

        // год: окно ±3, если явно не задано
        if (
          typeof eff.minYear !== 'number' &&
          typeof eff.maxYear !== 'number'
        ) {
          const Y = target.builtYear ?? null;
          if (typeof Y === 'number') {
            eff.minYear = Y - 3;
            eff.maxYear = Y + 3;
          }
        }

        // точные совпадения по cabins/heads, если у target заданы
        if (eff.cabins == null && target.cabins != null)
          eff.cabins = target.cabins;
        if (eff.heads == null && target.heads != null) eff.heads = target.heads;
      }

      // все прочие яхты (кроме target)
      const others = await this.prisma.yacht.findMany({
        where: target ? { id: { not: target.id } } : {},
      });

      // мапим к «кандидатам»
      const rawCandidates = others.map((y) => {
        const builtYear =
          (y as { builtYear?: number | null }).builtYear ?? null;

        // ✅ безопасное извлечение Decimal | number | string -> number
        let basePriceNum = 0;
        const bp = (y as { basePrice?: unknown }).basePrice;

        if (bp instanceof Prisma.Decimal) {
          // у Decimal есть toNumber()
          basePriceNum = bp.toNumber();
        } else {
          basePriceNum = Number(bp ?? 0);
        }

        return {
          competitorYacht:
            `${y.manufacturer ?? ''} ${y.model ?? y.name}`.trim() || y.name,
          lengthFt: this.filters.normalizeLengthToFeet(y.length) ?? null,
          cabins: y.cabins ?? null,
          heads: y.heads ?? null,
          year: builtYear,
          marina: y.location ?? null,
          type: (y as { type?: string | null }).type ?? null,
          price: new Prisma.Decimal(basePriceNum),
          currency: 'EUR',
          link: `internal://yacht/${y.id}`,
        };
      });

      const filtered = rawCandidates.filter((c) =>
        this.filters.passes(c, {
          jobId: job.id,
          dto,
          targetLenFt,
          targetType: target?.type ?? null,
          targetCabins: target?.cabins ?? null,
          targetHeads: target?.heads ?? null,
          targetYear: target?.builtYear ?? null,
          targetLocation: target?.location ?? null,
        }),
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
            yachtId: yachtIdToWrite ?? undefined,
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
        this.logger.log(
          `[${job.id}] upserted competitorPrice rows: ${upserts}`,
        );
      }

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
    const base = new Date(dto.week);
    const weekStart = getCharterWeekStartSaturdayUTC(base);

    const srcKey = (dto.source ??
      'BOATAROUND') as keyof typeof PrismaScrapeSource;
    const source: PrismaScrapeSource = PrismaScrapeSource[srcKey];

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

    const top1 = prices[0].price;
    const top3Nums = prices.slice(0, 3).map((p) => Number(p.price));
    const top3AvgNum =
      top3Nums.reduce((s, v) => s + v, 0) / Math.max(top3Nums.length, 1);
    const top3Avg = new Prisma.Decimal(top3AvgNum.toFixed(2));

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
