// backend/src/pricing/pricing.controller.ts

import { Body, Controller, Get, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingRowsQueryDto, UpsertDecisionDto, ChangeStatusDto } from './pricing.dto';

@Controller('pricing')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PricingController {
  constructor(private readonly svc: PricingService) {}

  @Get('rows')
  rows(@Query() q: PricingRowsQueryDto) {
    return this.svc.rows(q);
  }

  @Post('decision')
  upsert(@Body() dto: UpsertDecisionDto) {
    return this.svc.upsertDecision(dto);
  }

  @Post('status')
  change(@Body() dto: ChangeStatusDto) {
    return this.svc.changeStatus(dto);
  }
}