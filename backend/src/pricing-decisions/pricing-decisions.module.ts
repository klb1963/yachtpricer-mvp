import { Module } from '@nestjs/common';
import { PricingDecisionsController } from './pricing-decisions.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // PrismaModule глобальный
  controllers: [PricingDecisionsController],
})
export class PricingDecisionsModule {}