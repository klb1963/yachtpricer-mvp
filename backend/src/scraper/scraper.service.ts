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

function normalizeLengthToFeet(value: unknown): number | undefined {
  const n =
    typeof value === 'number'
      ? value
      : value instanceof Prisma.Decimal
        ? value.toNumber()
        : Number(value);

  if (!Number.isFinite(n) || n <= 0) return undefined;

  // Эвристика: если <= 30 — это почти наверняка метры (30 м = 98.4 ft)
  // иначе считаем, что уже футы.
  return n <= 30 ? n * M_TO_FT : n;
}

type CandidateLite = {
  lengthFt: number | null;
  cabins: number | null;
  heads: number | null;
  year: number | null;
  marina: string | null;
  type?: string | null;
};

type RawCandidate = CandidateLite & {
  competitorYacht: string;
  price: Prisma.Decimal;
  currency: string;
  link: string;
};

const filterLog = new Logger('ScraperFilter');

const norm = (s: string | null | undefined) => s?.trim().toLowerCase() ?? null;

function lengthFtTolerance(targetFt: number | undefined) {
  if (targetFt == null || !Number.isFinite(targetFt)) return 3;
  if (targetFt < 40) return 2;
  if (targetFt <= 50) return 3;
  return 4;
}

const countryAliases: Record<string, 'GR' | 'HR'> = {
  // Greece
  athens: 'GR',
  lefkada: 'GR',
  corfu: 'GR',
  kerkira: 'GR',
  lavrio: 'GR',
  alimos: 'GR',
  // Croatia
  split: 'HR',
  trogir: 'HR',
  dubrovnik: 'HR',
  kastela: 'HR',
  kaštela: 'HR',
  zadar: 'HR',
  pula: 'HR',
};

function guessCountry(place?: string | null): 'GR' | 'HR' | null {
  const s = norm(place);
  if (!s) return null;
  for (const key of Object.keys(countryAliases)) {
    if (s.includes(key)) return countryAliases[key];
  }
  return null;
}

function passesBusinessFilters(
  candidate: CandidateLite & { competitorYacht?: string },
  ctx: {
    targetLenFt?: number | null;
    dto: StartScrapeDto;
    targetType?: string | null;
    targetCabins?: number | null;
    targetHeads?: number | null;
    targetYear?: number | null;
    targetLocation?: string | null;
    jobId?: string | null;
  },
) {
  const name = candidate.competitorYacht ?? 'unknown';
  const reasons: string[] = [];

  // 1) Тип корпуса — обязательное совпадение (case-insensitive)
  if (ctx.targetType) {
    const ct = norm(candidate.type);
    const tt = norm(ctx.targetType);
    if (!ct || ct !== tt) {
      reasons.push(`type mismatch: cand=${ct ?? '∅'} target=${tt}`);
    }
  }

  // 2) Длина по целевому значению с допуском
  if (typeof ctx.targetLenFt === 'number' && candidate.lengthFt != null) {
    const tol = lengthFtTolerance(ctx.targetLenFt);
    if (
      candidate.lengthFt < ctx.targetLenFt - tol ||
      candidate.lengthFt > ctx.targetLenFt + tol
    ) {
      reasons.push(
        `length ${candidate.lengthFt}ft ∉ [${(ctx.targetLenFt - tol).toFixed(
          1,
        )}; ${(ctx.targetLenFt + tol).toFixed(1)}]`,
      );
    }
  }

  // 3) Кабины: точное или ±1
  if (
    typeof ctx.targetCabins === 'number' &&
    candidate.cabins != null &&
    Math.abs(candidate.cabins - ctx.targetCabins) > 1
  ) {
    reasons.push(
      `cabins ${candidate.cabins} vs target ${ctx.targetCabins} (±1)`,
    );
  }

  // 4) Санузлы: candidate.heads >= target.heads
  if (
    typeof ctx.targetHeads === 'number' &&
    candidate.heads != null &&
    candidate.heads < ctx.targetHeads
  ) {
    reasons.push(`heads ${candidate.heads} < target ${ctx.targetHeads}`);
  }

  // 5) Год: окно ±2
  if (
    typeof ctx.targetYear === 'number' &&
    candidate.year != null &&
    Math.abs(candidate.year - ctx.targetYear) > 2
  ) {
    reasons.push(`year ${candidate.year} not in ±2 of ${ctx.targetYear}`);
  }

  // 6) Локация: сначала пытаемся сравнить страну, иначе – подстрока
  if (ctx.targetLocation) {
    const candStr = norm(candidate.marina);
    const targStr = norm(ctx.targetLocation);

    const candCountry = guessCountry(candStr);
    const targCountry = guessCountry(targStr);

    const sameCountry =
      candCountry && targCountry ? candCountry === targCountry : false;

    const substringOk = targStr && candStr ? candStr.includes(targStr) : false;

    if (!sameCountry && !substringOk) {
      reasons.push(
        `location "${candidate.marina}" !~ "${ctx.targetLocation}" (country ${candCountry ?? '∅'} vs ${targCountry ?? '∅'})`,
      );
    }
  }

  // 7) Явные ограничения из dto (если пользователь их передал)
  const { dto } = ctx;

  if (
    (typeof dto.minLength === 'number' || typeof dto.maxLength === 'number') &&
    candidate.lengthFt != null
  ) {
    const minFt = typeof dto.minLength === 'number' ? dto.minLength : -Infinity;
    const maxFt = typeof dto.maxLength === 'number' ? dto.maxLength : Infinity;
    if (candidate.lengthFt < minFt || candidate.lengthFt > maxFt) {
      reasons.push(
        `dto length bounds: ${candidate.lengthFt}ft ∉ [${Number.isFinite(minFt) ? minFt.toFixed(1) : '-∞'}; ${Number.isFinite(maxFt) ? maxFt.toFixed(1) : '+∞'}]`,
      );
    }
  }

  if (
    typeof dto.cabins === 'number' &&
    candidate.cabins != null &&
    candidate.cabins !== dto.cabins
  ) {
    reasons.push(`dto cabins exact: ${candidate.cabins} != ${dto.cabins}`);
  }

  if (
    typeof dto.heads === 'number' &&
    candidate.heads != null &&
    candidate.heads < dto.heads
  ) {
    reasons.push(`dto heads min: ${candidate.heads} < ${dto.heads}`);
  }

  if (
    typeof dto.minYear === 'number' &&
    candidate.year != null &&
    candidate.year < dto.minYear
  ) {
    reasons.push(`dto minYear: ${candidate.year} < ${dto.minYear}`);
  }

  if (
    typeof dto.maxYear === 'number' &&
    candidate.year != null &&
    candidate.year > dto.maxYear
  ) {
    reasons.push(`dto maxYear: ${candidate.year} > ${dto.maxYear}`);
  }

  if (dto.location && candidate.marina) {
    const a = norm(candidate.marina);
    const b = norm(dto.location);
    if (b && a && !a.includes(b)) {
      reasons.push(`dto location "${candidate.marina}" !~ "${dto.location}"`);
    }
  }

  if (reasons.length) {
    filterLog.log(
      `[${ctx.jobId ?? '-'}] DROP "${name}": ${reasons.join(' | ')}`,
    );
    return false;
  }

  filterLog.log(`[${ctx.jobId ?? '-'}] KEEP "${name}"`);
  return true;
}

// ====================

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(private readonly prisma: PrismaService) {
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
          targetLenFt = normalizeLengthToFeet(y.length);
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
      const rawCandidates: RawCandidate[] = others.map((y) => {
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
          lengthFt: normalizeLengthToFeet(y.length) ?? null,
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
        passesBusinessFilters(c, {
          jobId: job.id,
          targetLenFt,
          dto,
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
