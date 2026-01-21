// backend/src/pricing/pricing.controller.ts

import {
  Body,
  Controller,
  Delete,
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
  GetPriceListNodesQueryDto,
  UpsertPriceListNodeDto,
  DeletePriceListNodeDto,
} from './pricing.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';

@Controller('pricing')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PricingController {
  constructor(private readonly svc: PricingService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // PriceListNode endpoints
  // ───────────────────────────────────────────────────────────────────────────

  @Get('price-list-nodes')
  listPriceListNodes(
    @Query() q: GetPriceListNodesQueryDto,
    @CurrentUser() user: User | null,
  ) {
    if (!user) throw new UnauthorizedException();
    return this.svc.listPriceListNodes(q, user);
  }

  @Post('price-list-nodes')
  upsertPriceListNode(
    @Body() dto: UpsertPriceListNodeDto,
    @CurrentUser() user: User | null,
  ) {
    if (!user) throw new UnauthorizedException();
    return this.svc.upsertPriceListNode(dto, user);
  }

  @Delete('price-list-nodes')
  deletePriceListNode(
    @Body() dto: DeletePriceListNodeDto,
    @CurrentUser() user: User | null,
  ) {
    if (!user) throw new UnauthorizedException();
    return this.svc.deletePriceListNode(dto, user);
  }

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
  async change(@Body() dto: ChangeStatusDto, @CurrentUser() user: User | null) {
    // ⚠️ только для локальной отладки
    if (!user) {
      console.warn(
        '[pricing.status] CurrentUser is null → using DEV stub user',
      );
      user = {
        id: 'dev-user',
        email: 'dev@example.com',
        name: 'Dev User',
        role: 'ADMIN',
        orgId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User; // 👈 теперь это полноценный User
    }

    console.log('[CTRL] changeStatus DTO:', JSON.stringify({ ...dto }));
    return this.svc.changeStatus(dto, user);
  }
}
