// backend/src/pricing-decisions/pricing-decisions.module.ts

import { Module } from '@nestjs/common';
import { PricingDecisionsController } from './pricing-decisions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule], // PrismaModule глобальный
  controllers: [PricingDecisionsController],
})
export class PricingDecisionsModule {}
