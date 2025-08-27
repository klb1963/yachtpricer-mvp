// backend/src/app.module.ts

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { YachtsController } from './yachts.controller';
import { PrismaModule } from './prisma/prisma.module';
import { PricingModule } from './pricing/pricing.module';

import { ScraperModule } from './scraper/scraper.module';

@Module({
  imports: [PrismaModule, ScraperModule, PricingModule],
  controllers: [AppController, YachtsController],
  providers: [AppService],
})
export class AppModule {}
