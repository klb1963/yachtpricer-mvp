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
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { FilterScope } from '@prisma/client';
import { FilterPresetsService } from './filter-presets.service';

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
  async list(@Req() req: Request) {
    const orgId = req.headers['x-org-id'] as string | undefined;
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!orgId) throw new BadRequestException('User has no organization.');
    return this.svc.list(orgId, userId);
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-org-id'] as string | undefined;
    if (!orgId) throw new BadRequestException('User has no organization.');
    return this.svc.getOne(orgId, id);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: PresetInput) {
    const orgId = req.headers['x-org-id'] as string | undefined;
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!orgId) throw new BadRequestException('User has no organization.');
    return this.svc.create(orgId, userId, body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: PresetInput,
  ) {
    const orgId = req.headers['x-org-id'] as string | undefined;
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!orgId) throw new BadRequestException('User has no organization.');
    return this.svc.update(orgId, userId, id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-org-id'] as string | undefined;
    if (!orgId) throw new BadRequestException('User has no organization.');
    return this.svc.remove(orgId, id);
  }
}
