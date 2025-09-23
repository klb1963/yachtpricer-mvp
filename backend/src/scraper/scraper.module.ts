// backend/src/scraper/scraper.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';
import { FiltersService } from './filter/filters.service';

@Module({
  imports: [PrismaModule],
  controllers: [ScraperController],
  providers: [ScraperService, FiltersService],
})
export class ScraperModule {
  constructor() {
    console.log('✅ ScraperModule loaded');
  }
}
