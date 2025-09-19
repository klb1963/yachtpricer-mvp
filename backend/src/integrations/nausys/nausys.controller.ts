// backend/src/integrations/nausys/nausys.controller.ts

// backend/src/integrations/nausys/nausys.controller.ts

import { Controller, Get, Post, Body } from '@nestjs/common';
import { NausysService } from './nausys.service';
import { NausysLoginDto } from './nausys.dto';

@Controller('nausys')
export class NausysController {
  constructor(private readonly nausys: NausysService) {}

  @Get('ping')
  ping(): { ok: true; ts: string } {
    return { ok: true as const, ts: new Date().toISOString() };
  }

  @Post('login')
  async login(@Body() dto: NausysLoginDto) {
    return this.nausys.login(dto);
  }

  // ⚠️ Остальные эндпойнты добавим после — чтобы не мешали сборке.
  // @Get('yachts-auto') ...
  // @Post('sync-locations') ...
}
