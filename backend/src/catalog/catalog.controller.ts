// backend/src/catalog/catalog.controller.ts

import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly svc: CatalogService) {}

  @Get('categories')
  async getCategories(
    @Query('query') query = '',
    @Query('take') takeStr = '20',
  ): Promise<{
    items: Array<{ id: number; nameEn: string | null; nameRu: string | null }>;
  }> {
    const take = Math.min(
      Math.max(parseInt(takeStr || '20', 10) || 20, 1),
      200,
    );
    return await this.svc.findCategories(query, take);
  }

  @Get('builders')
  async getBuilders(
    @Query('query') query = '',
    @Query('take') takeStr = '20',
  ): Promise<{ items: Array<{ id: number; name: string }> }> {
    const take = Math.min(
      Math.max(parseInt(takeStr || '20', 10) || 20, 1),
      200,
    );
    return await this.svc.findBuilders(query, take);
  }

  @Get('models')
  async getModels(
    @Query('query') query = '',
    @Query('builderId') builderIdStr?: string,
    @Query('categoryId') categoryIdStr?: string,
    @Query('take') takeStr = '20',
  ): Promise<{
    items: Array<{
      id: number;
      name: string;
      builderId: number | null;
      categoryId: number | null;
    }>;
  }> {
    const take = Math.min(
      Math.max(parseInt(takeStr || '20', 10) || 20, 1),
      200,
    );
    const builderId = builderIdStr ? parseInt(builderIdStr, 10) : undefined;
    const categoryId = categoryIdStr ? parseInt(categoryIdStr, 10) : undefined;
    return await this.svc.findModels({ query, builderId, categoryId, take });
  }

  // ✅ Новые каскадные эндпоинты
  @Get('countries')
  async getCountries(): Promise<{
    items: Array<{ id: string; code2: string; name: string }>;
  }> {
    return await this.svc.findCountries();
  }

  @Get('regions')
  async getRegions(
    @Query('countryIds') countryIdsStr?: string,
    @Query('take') takeStr = '50',
  ): Promise<{ items: any[] }> {
    const countryIds = countryIdsStr
      ? countryIdsStr.split(',').filter(Boolean)
      : [];
    const take = Math.min(
      Math.max(parseInt(takeStr || '50', 10) || 50, 1),
      500,
    );
    return await this.svc.findRegionsCascade({ countryIds, take });
  }

  @Get('locations')
  async getLocations(
    @Query('countryIds') countryIdsStr?: string,
    @Query('regionIds') regionIdsStr?: string,
    @Query('source') source?: string,
    @Query('take') takeStr = '100',
  ): Promise<{ items: any[]; total: number }> {
    const countryIds = countryIdsStr
      ? countryIdsStr.split(',').filter(Boolean)
      : [];
    const regionIds = regionIdsStr
      ? regionIdsStr.split(',').filter(Boolean).map(Number)
      : [];
    const take = Math.min(
      Math.max(parseInt(takeStr || '100', 10) || 100, 1),
      1000,
    );
    return await this.svc.findLocationsCascade({
      countryIds,
      regionIds,
      source,
      take,
    });
  }
}
