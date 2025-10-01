// backend/src/geo/geo.controller.ts

import { Controller, Get, Query } from '@nestjs/common';
import { GeoService } from './geo.service';
import { GetLocationsDto } from './dto/get-locations.dto';
import { Public } from '../auth/public.decorator';

@Controller('geo') // при globalPrefix('api') это даст /api/geo/**
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Public()
  @Get('countries')
  getCountries() {
    return this.geo.getCountries();
  }

  @Public()
  @Get('locations')
  getLocations(@Query() dto: GetLocationsDto) {
    return this.geo.getLocations({
      q: dto.q,
      countryCode: dto.countryCode,
      orderBy: dto.orderBy || 'name', // дефолтное значение
      take: dto.take ?? 50,
      skip: dto.skip ?? 0,
    });
  }
}
