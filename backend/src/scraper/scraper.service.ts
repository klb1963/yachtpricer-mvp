// backend/src/scraper/scraper.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StartScrapeDto } from './scraper.dto';
import {
  Prisma,
  JobStatus,
  ScrapeSource,
  type ScrapeJob,
} from '@prisma/client';

/**
 * Нормализует дату к началу чартерной недели (суббота 00:00 UTC).
 * Используется для консистентного хранения недельных цен.
 */
function getCharterWeekStartSaturdayUTC(input: Date): Date {
  const d = new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()),
  );
  const day = d.getUTCDay();
  const diff = (day - 6 + 7) % 7; // смещение до субботы
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Преобразует DTO в JSON для сохранения в ScrapeJob.params.
 * Null-значения вместо undefined для согласованности.
 */
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
    source: dto.source ?? ScrapeSource.BOATAROUND,
  };
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Запускает задачу скрейпа.
   * - Создаёт запись ScrapeJob
   * - Опционально привязывает данные к существующей яхте
   * - Сохраняет в CompetitorPrice тестовые данные (заглушка)
   */
  async start(
    dto: StartScrapeDto,
  ): Promise<{ jobId: string; status: JobStatus }> {
    // Создаём job в статусе PENDING
    const job: ScrapeJob = await this.prisma.scrapeJob.create({
      data: {
        source: dto.source ?? ScrapeSource.BOATAROUND,
        params: dtoToJson(dto),
        status: JobStatus.PENDING,
      },
    });

    try {
      // Переводим в RUNNING
      this.logger.log(`[${job.id}] set RUNNING`);
      await this.prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: JobStatus.RUNNING, startedAt: new Date() },
      });

      // Определяем неделю
      const base = dto.weekStart ? new Date(dto.weekStart) : new Date();
      const weekStart = getCharterWeekStartSaturdayUTC(base);

      // Проверка FK yachtId
      let yachtIdForInsert: string | undefined;
      if (dto.yachtId) {
        const exists = await this.prisma.yacht.findUnique({
          where: { id: dto.yachtId },
        });
        if (exists) {
          yachtIdForInsert = dto.yachtId;
        } else {
          this.logger.warn(
            `[${job.id}] yachtId ${dto.yachtId} not found — writing competitor prices without FK`,
          );
        }
      }

      // Вставка тестовых данных (заглушка)
      this.logger.log(
        `[${job.id}] before createMany ${weekStart.toISOString()}`,
      );
      await this.prisma.competitorPrice.createMany({
        data: [
          {
            ...(yachtIdForInsert ? { yachtId: yachtIdForInsert } : {}),
            weekStart,
            source: dto.source ?? ScrapeSource.BOATAROUND,
            competitorYacht: 'Bavaria 46 2019 (Demo)',
            price: new Prisma.Decimal(4800),
            currency: 'EUR',
            link: 'https://example.com/boat1',
            scrapedAt: new Date(),
          },
          {
            ...(yachtIdForInsert ? { yachtId: yachtIdForInsert } : {}),
            weekStart,
            source: dto.source ?? ScrapeSource.BOATAROUND,
            competitorYacht: 'Beneteau Oceanis 45 (Demo)',
            price: new Prisma.Decimal(4550),
            currency: 'EUR',
            link: 'https://example.com/boat2',
            scrapedAt: new Date(),
          },
        ],
        skipDuplicates: true,
      });
      this.logger.log(`[${job.id}] after createMany`);

      // Завершаем job
      await this.prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: JobStatus.DONE, finishedAt: new Date() },
      });
      this.logger.log(`[${job.id}] job DONE`);
    } catch (err) {
      // Логируем ошибку и помечаем job как FAILED
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

  /**
   * Возвращает статус конкретного job по ID.
   */
  async status(jobId: string) {
    return this.prisma.scrapeJob.findUnique({ where: { id: jobId } });
  }

  /**
   * Возвращает цены конкурентов по фильтрам:
   * - yachtId (опционально)
   * - неделя week (любая дата внутри нужной недели, нормализуется к субботе)
   */
  async getCompetitors(q: { yachtId?: string; week?: string }) {
    let weekFilter: Prisma.CompetitorPriceWhereInput = {};

    if (q.week) {
      const base = new Date(q.week);
      const weekStart = getCharterWeekStartSaturdayUTC(base);
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

      weekFilter = {
        weekStart: {
          gte: weekStart,
          lt: weekEnd,
        },
      };
    }

    return this.prisma.competitorPrice.findMany({
      where: {
        ...(q.yachtId ? { yachtId: q.yachtId } : {}),
        ...weekFilter,
      },
      orderBy: [{ scrapedAt: 'desc' }],
      take: 50,
    });
  }
}
