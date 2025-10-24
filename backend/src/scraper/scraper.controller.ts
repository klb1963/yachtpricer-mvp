// backend/src/scraper/scraper.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

import type { User } from '@prisma/client';

import { ScraperService } from './scraper.service';
import { PrismaService } from '../prisma/prisma.service';
import { FiltersService } from './filter/filters.service';

import {
  StartScrapeDto,
  StartResponseDto,
  ScrapeStatusQueryDto,
  CompetitorsQueryDto,
  AggregateDto,
  TestFiltersDto,
} from './scraper.dto';

import { collectNausysCandidates } from './vendors/nausys.collect';

// Вспомогательный тип для предпросмотра NAUSYS (без записи в БД)
type PreviewCandidate = {
  competitorYacht: string;
  lengthFt: number | null;
  cabins: number | null;
  heads: number | null;
  year: number | null;
  marina: string | null;
  type: string | null;
  countryCode: string | null;
  categoryId: number | null;
  builderId: number | null;
  price: number;
  currency: string;
  link: string;
};

@Controller('scrape')
// Локальный ValidationPipe: трансформирует строки в числа/даты по декораторам и отсекает лишние поля.
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);

  constructor(
    private readonly svc: ScraperService,
    private readonly prisma: PrismaService,
    private readonly filters: FiltersService,
  ) {
    this.logger.log('ScraperController initialized');
  }

  /**
   * Старт задачи скрейпа.
   */
  @Public()
  @Post('start')
  @Roles('MANAGER', 'ADMIN')
  start(
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
    @Body() dto: StartScrapeDto,
  ): Promise<StartResponseDto> {
    const { yachtId, weekStart, source, filterId } = dto;
    this.logger.log(
      `hit /scrape/start: ${JSON.stringify({
        yachtId,
        weekStart,
        source,
        filterId: filterId ?? null,
        userOrgId: user?.orgId ?? null,
      })}`,
    );
    return this.svc.start(dto, user);
  }

  @Post('aggregate')
  @Roles('MANAGER', 'ADMIN')
  aggregate(@Body() dto: AggregateDto) {
    return this.svc.aggregate(dto);
  }

  /**
   * Статус ранее запущенной задачи по jobId.
   */
  @Get('status')
  status(@Query() query: ScrapeStatusQueryDto) {
    return this.svc.status(query.jobId);
  }

  /**
   * Сохранённые цены конкурентов.
   */
  @Get('competitors-prices')
  list(@Query() query: CompetitorsQueryDto) {
    return this.svc.getCompetitors({
      yachtId: query.yachtId,
      week: query.week,
      source: query.source,
    });
  }

  /**
   * Dry-run тест фильтров: вернуть только количество подходящих яхт.
   */
  @Post('test')
  @Roles('MANAGER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async test(
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
    @Body() dto: TestFiltersDto,
  ): Promise<{ count: number }> {
    this.logger.log(
      `hit /scrape/test: ${JSON.stringify({
        countryCodes: dto.countryCodes?.length ?? 0,
        categoryIds: dto.categoryIds?.length ?? 0,
        builderIds: dto.builderIds?.length ?? 0,
        userOrgId: user?.orgId ?? null,
      })}`,
    );
    return this.svc.testFilters(dto);
  }

  // ──────────────────────────────────────────────────────────────
  // Быстрый предпросмотр NAUSYS без записи в БД (с фильтрами)
  // ──────────────────────────────────────────────────────────────
  @Public()
  @Get('nausys/preview')
  // @Roles('MANAGER', 'ADMIN')
  async nausysPreview(
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
    @Query('yachtId') yachtId: string,
    @Query('week') week: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = Math.max(1, Math.min(Number(limitStr ?? 50) || 50, 200));

    // Нормализуем неделю к субботе 00:00 UTC
    const base = new Date(week);
    const weekStart = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()),
    );
    const day = weekStart.getUTCDay(); // 0..6, где 6 — суббота
    const diff = (day - 6 + 7) % 7;
    weekStart.setUTCDate(weekStart.getUTCDate() - diff);
    weekStart.setUTCHours(0, 0, 0, 0);
    const periodTo = new Date(weekStart);
    periodTo.setUTCDate(periodTo.getUTCDate() + 7);

    // Таргет-яхта
    const target = await this.prisma.yacht.findUnique({
      where: { id: yachtId },
    });
    if (!target) {
      return { error: 'target yacht not found', yachtId };
    }

    // Активный конфиг фильтров
    await this.filters.loadConfig(this.prisma, {
      orgId: user?.orgId ?? target?.orgId ?? null,
      userId: user?.id ?? null,
      filterId: undefined,
    });

    const targetLenFt =
      this.filters.normalizeLengthToFeet(target.length) ?? null;
    const targetType = (target?.type as string | null) ?? null;
    const targetCabins = target?.cabins ?? null;
    const targetHeads = target?.heads ?? null;
    const targetYear = target?.builtYear ?? null;
    const targetLocation = target?.location ?? null;

    // Сбор кандидатов
    const candidates = await collectNausysCandidates({
      creds: {
        username: process.env.NAUSYS_USERNAME!,
        password: process.env.NAUSYS_PASSWORD!,
      },
      periodFrom: weekStart,
      periodTo,
      candidateTypeHint: targetType,
    });

    // Прогоняем через passes()
    const kept: Array<PreviewCandidate & { raw: unknown }> = [];
    const dropped: Array<{ candidate: PreviewCandidate; reason: string }> = [];
    const reasonCounts = new Map<string, number>();

    for (const c of candidates) {
      const res = this.filters.passes(c, {
        jobId: 'preview',
        dto: {
          yachtId,
          weekStart: weekStart.toISOString(),
          source: 'NAUSYS',
        } as StartScrapeDto,
        targetLenFt,
        targetType,
        targetCabins,
        targetHeads,
        targetYear,
        targetLocation,
      });

      if (res.ok) {
        kept.push(c);
      } else {
        const reason = res.reason ?? 'unknown';
        dropped.push({ candidate: c, reason });
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      }
    }

    const topReasons = [...reasonCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));

    // Компактный ответ
    return {
      weekStart: weekStart.toISOString(),
      fetched: candidates.length,
      accepted: kept.length,
      dropped: dropped.length,
      topReasons,
      keptSample: kept.slice(0, limit).map((k) => ({
        competitorYacht: k.competitorYacht,
        price: k.price,
        currency: k.currency,
        lengthFt: k.lengthFt,
        cabins: k.cabins,
        heads: k.heads,
        year: k.year,
        marina: k.marina,
        link: k.link,
      })),
    };
  }
}
