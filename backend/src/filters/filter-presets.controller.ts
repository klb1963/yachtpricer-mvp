// backend/src/filters/filter-presets.controller.ts

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { FilterScope, User } from '@prisma/client';
import { FilterPresetsService } from './filter-presets.service';
import { CurrentUser } from '../auth/current-user.decorator';

// Тип входных данных (аналогично PresetInput из сервиса)
type PresetInput = {
  name?: string;
  scope?: FilterScope;
  countryIds?: string[];
  regionIds?: number[];
  locationIds?: string[];
  categoryIds?: number[];
  builderIds?: number[];
  modelIds?: number[];
  lenFtMinus?: number;
  lenFtPlus?: number;
  yearMinus?: number;
  yearPlus?: number;
  peopleMinus?: number;
  peoplePlus?: number;
  cabinsMinus?: number;
  cabinsPlus?: number;
  headsMin?: number;
};

@Controller('filters/presets')
export class FilterPresetsController {
  constructor(private readonly svc: FilterPresetsService) {}

  @Get()
  async list(@CurrentUser() user: Pick<User, 'id' | 'orgId'>) {
    if (!user?.orgId) {
      throw new BadRequestException('User has no organization.');
    }
    return this.svc.list(user.orgId, user.id);
  }

  @Get(':id')
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
  ) {
    if (!user?.orgId) {
      throw new BadRequestException('User has no organization.');
    }
    return this.svc.getOne(user.orgId, id);
  }

  @Post()
  async create(
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
    @Body() body: PresetInput,
  ) {
    if (!user?.orgId) {
      throw new BadRequestException('User has no organization.');
    }
    return this.svc.create(user.orgId, user.id, body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
    @Body() body: PresetInput,
  ) {
    if (!user?.orgId) {
      throw new BadRequestException('User has no organization.');
    }
    return this.svc.update(user.orgId, user.id, id, body);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: Pick<User, 'id' | 'orgId'>,
  ) {
    if (!user?.orgId) {
      throw new BadRequestException('User has no organization.');
    }
    return this.svc.remove(user.orgId, id);
  }
}
