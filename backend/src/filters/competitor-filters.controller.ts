// backend/src/filters/competitor-filters.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
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
  update(
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
    @Body() dto: CompetitorFiltersBody,
  ) {
    if (!user?.orgId) {
      throw new BadRequestException('User has no organization.');
    }
    return this.svc.upsert(user.orgId, user.id, dto);
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
