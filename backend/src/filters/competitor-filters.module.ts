// backend/src/filters/competitor-filters.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CompetitorFiltersService } from './competitor-filters.service';
import { CompetitorFiltersController } from './competitor-filters.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CompetitorFiltersController],
  providers: [CompetitorFiltersService],
  exports: [CompetitorFiltersService],
})
export class CompetitorFiltersModule {}
