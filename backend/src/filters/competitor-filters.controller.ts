// backend/src/filters/competitor-filters.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Delete,
} from '@nestjs/common';
import { CompetitorFiltersService } from './competitor-filters.service';
import { GetFiltersQuery } from './dto/get-filters.query';
import { FilterScope, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { CompetitorFiltersBody } from './dto/competitor-filters.dto';

@Controller('filters/competitors')
export class CompetitorFiltersController {
  constructor(private readonly svc: CompetitorFiltersService) {}

  @Get()
  get(
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
    @Query() q: GetFiltersQuery,
  ) {
    if (!user?.orgId) {
      throw new BadRequestException('User has no organization.');
    }
    const scope = q.scope ?? FilterScope.USER;
    return this.svc.getForCurrent(user.orgId, user.id, scope);
  }

  @Patch()
  async update(
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
    @Body() dto: CompetitorFiltersBody,
  ): Promise<{ id: string }> {
    if (!user?.orgId) {
      throw new BadRequestException('User has no organization.');
    }

    const saved = await this.svc.upsert(user.orgId, user.id, dto);

    if (!saved || !saved.id) {
      throw new BadRequestException('Failed to save competitor filters.');
    }

    // Возвращаем строго типизированный ответ
    return { id: String(saved.id) };
  }

  // ---- Dry-run: вернуть только количество по текущим фильтрам
  @Post('test')
  async testFilters(
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
    @Body() dto: CompetitorFiltersBody,
  ) {
    if (!user?.orgId) {
      throw new BadRequestException('User has no organization.');
    }
    const count = await this.svc.testCount(user.orgId, user.id, dto);
    return { count };
  }

  @Delete()
  reset(
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
    @Query('scope') scope: FilterScope = FilterScope.USER,
  ) {
    if (!user?.orgId) {
      throw new BadRequestException('User has no organization.');
    }
    return this.svc.reset(user.orgId, user.id, scope);
  }
}
