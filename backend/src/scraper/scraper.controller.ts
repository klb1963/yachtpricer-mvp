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
} from '@nestjs/common';
import { ScraperService } from './scraper.service';
import {
  StartScrapeDto,
  StartResponseDto,
  ScrapeStatusQueryDto,
  CompetitorsQueryDto,
  AggregateDto,
  TestFiltersDto,
} from './scraper.dto';
import { Roles } from '../auth/roles.decorator';
// import { Public } from '../auth/public.decorator';
import { HttpCode, HttpStatus } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '@prisma/client';

@Controller('scrape')
// Локальный ValidationPipe: трансформирует строки в числа/даты по декораторам и отсекает лишние поля.
// Если глобальный пайп включён в main.ts — этот можно убрать, но дублирование не вредно.
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);

  constructor(private readonly svc: ScraperService) {
    // Короткий лог инициализации контроллера (1 раз при старте)
    this.logger.log('ScraperController initialized');
  }

  /**
   * Старт задачи скрейпа.
   * В лог пишем только ключевые поля (без полного JSON), чтобы не засорять логи и не светить лишнее.
   */
  @Post('start')
  @Roles('MANAGER', 'ADMIN')
  start(
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
    @Body() dto: StartScrapeDto,
  ): Promise<StartResponseDto> {
    try {
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
    } catch (err) {
      this.logger.warn(
        `hit /scrape/start (failed to stringify dto): ${String(err)}`,
      );
    }
    return this.svc.start(dto, user);
  }

  @Post('aggregate')
  @Roles('MANAGER', 'ADMIN')
  aggregate(@Body() dto: AggregateDto) {
    return this.svc.aggregate(dto);
  }

  /**
   * Статус ранее запущенной задачи по jobId.
   * DTO валидирует формат jobId (если задан), а сервис возвращает запись из БД.
   */
  @Get('status')
  status(@Query() query: ScrapeStatusQueryDto) {
    return this.svc.status(query.jobId);
  }

  /**
   * Выдаёт сохранённые цены конкурентов.
   * Фильтры: по yachtId и/или неделе (любой день недели — в сервисе нормализуется к субботе).
   */
  @Get('competitors-prices')
  list(@Query() query: CompetitorsQueryDto) {
    return this.svc.getCompetitors({
      yachtId: query.yachtId,
      week: query.week,
    });
  }

  /**
   * Dry-run тест фильтров: возвращает только количество подходящих яхт.
   * Поддерживаются countryCodes (ISO-2), categoryIds, builderIds.
   */
  /**
   * Dry-run тест фильтров: возвращает только количество подходящих яхт.
   * Поддерживаются countryCodes (ISO-2), categoryIds, builderIds.
   */
  @Post('test')
  // @Public() // временно, чтобы фронт мог дернуть без настройки маппинга Clerk→User
  @Roles('MANAGER', 'ADMIN')
  @HttpCode(HttpStatus.OK) // 👈 теперь ответ всегда 200 вместо 201
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
    // Сервис пока не принимает user — передаём только dto.
    return this.svc.testFilters(dto);
  }
}
