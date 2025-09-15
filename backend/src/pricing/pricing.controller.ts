// backend/src/pricing/pricing.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { PricingService } from './pricing.service';
import {
  PricingRowsQueryDto,
  UpsertDecisionDto,
  ChangeStatusDto,
} from './pricing.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';

@Controller('pricing')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PricingController {
  constructor(private readonly svc: PricingService) {}

  @Get('rows')
  rows(@Query() q: PricingRowsQueryDto, @CurrentUser() user: User | null) {
    if (!user) throw new UnauthorizedException();
    return this.svc.rows(q, user);
  }

  @Post('decision')
  upsert(@Body() dto: UpsertDecisionDto, @CurrentUser() user: User | null) {
    if (!user) throw new UnauthorizedException();
    return this.svc.upsertDecision(dto, user);
  }

  @Post('status')
  change(@Body() dto: ChangeStatusDto, @CurrentUser() user: User | null) {
    if (!user) throw new UnauthorizedException();
    console.log('[CTRL] changeStatus DTO:', dto); // ← временно
    return this.svc.changeStatus(dto, user);
  }
}
