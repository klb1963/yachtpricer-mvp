// backend/src/integrations/nausys/nausys.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { NausysService } from './nausys.service';
import { NausysLoginDto, NausysGetYachtsResponse } from './nausys.dto';

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

  @Get('yachts')
  async yachts(
    @Query('token') token?: string,
  ): Promise<NausysGetYachtsResponse> {
    if (!token) {
      throw new BadRequestException('Query param "token" is required');
    }
    return this.nausys.getYachts(token);
  }
}
