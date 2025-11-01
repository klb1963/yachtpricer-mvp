// backend/src/filters/competitor-filters.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { CompetitorFiltersController } from './competitor-filters.controller';
import { CompetitorFiltersService } from './competitor-filters.service';

import { FilterPresetsController } from './filter-presets.controller';
import { FilterPresetsService } from './filter-presets.service';

import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [CompetitorFiltersController, FilterPresetsController],
  providers: [CompetitorFiltersService, FilterPresetsService, PrismaService],
  exports: [CompetitorFiltersService, FilterPresetsService],
})
export class CompetitorFiltersModule {}
