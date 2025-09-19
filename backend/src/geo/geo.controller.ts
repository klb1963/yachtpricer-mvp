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
  getLocations(@Query() q: GetLocationsDto) {
    const {
      q: text,
      countryCode,
      orderBy,
      take: takeRaw,
      skip: skipRaw,
    } = q as unknown as {
      q?: string;
      countryCode?: string;
      orderBy?: 'name' | 'countryCode';
      take?: string | number;
      skip?: string | number;
    };

    const take =
      typeof takeRaw === 'number'
        ? takeRaw
        : Number.isFinite(+takeRaw!)
          ? +takeRaw!
          : 50;

    const skip =
      typeof skipRaw === 'number'
        ? skipRaw
        : Number.isFinite(+skipRaw!)
          ? +skipRaw!
          : 0;

    const ord: 'name' | 'countryCode' =
      orderBy === 'countryCode' ? 'countryCode' : 'name';

    return this.geo.getLocations({
      q: text,
      countryCode,
      orderBy: ord,
      take,
      skip,
    });
  }
}
