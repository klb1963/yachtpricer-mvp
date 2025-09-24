// backend/src/pricing/pricing.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { PricingRepo } from './pricing.repo';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PricingController],
  providers: [PricingService, PricingRepo],
})
export class PricingModule {}
