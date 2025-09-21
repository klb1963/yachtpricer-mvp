// backend/src/filters/competitor-filters.controller.ts

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { CompetitorFiltersService } from './competitor-filters.service';
import { UpdateCompetitorFiltersDto } from './dto/update-competitor-filters.dto';
import { GetFiltersQuery } from './dto/get-filters.query';
import { FilterScope, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('filters/competitors')
export class CompetitorFiltersController {
  constructor(private readonly svc: CompetitorFiltersService) {}

  @Get()
  get(
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    q: GetFiltersQuery,
  ) {
    if (!user?.orgId) {
      throw new BadRequestException('User has no organization.');
    }
    const scope = q.scope ?? FilterScope.USER;
    return this.svc.getForCurrent(user.orgId, user.id, scope);
  }

  @Patch()
  update(
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateCompetitorFiltersDto,
  ) {
    if (!user?.orgId) {
      throw new BadRequestException('User has no organization.');
    }
    return this.svc.upsert(user.orgId, user.id, dto);
  }
}
