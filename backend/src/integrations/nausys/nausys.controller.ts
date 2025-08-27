// backend/src/integrations/nausys/nausys.controller.ts

import { Controller, Get, Post } from '@nestjs/common';
import { NausysService } from './nausys.service';

@Controller('nausys')
export class NausysController {
  constructor(private readonly nausys: NausysService) {}

  @Post('login')
  async login() {
    return this.nausys.login();
  }

  @Get('yachts')
  async yachts() {
    // Для примера делаем прямой login → getYachts
    const { token } = await this.nausys.login();
    return this.nausys.getYachts(token);
  }
}