// backend/src/catalog/catalog.controller.ts

import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly svc: CatalogService) {}

  @Get('categories')
  getCategories(
    @Query('query') query = '',
    @Query('take') takeStr = '20',
  ) {
    const take = Math.min(Math.max(parseInt(takeStr || '20', 10) || 20, 1), 200);
    return this.svc.findCategories(query, take);
  }

  @Get('builders')
  getBuilders(
    @Query('query') query = '',
    @Query('take') takeStr = '20',
  ) {
    const take = Math.min(Math.max(parseInt(takeStr || '20', 10) || 20, 1), 200);
    return this.svc.findBuilders(query, take);
  }

  @Get('models')
  getModels(
    @Query('query') query = '',
    @Query('builderId') builderIdStr?: string,
    @Query('categoryId') categoryIdStr?: string,
    @Query('take') takeStr = '20',
  ) {
    const take = Math.min(Math.max(parseInt(takeStr || '20', 10) || 20, 1), 200);
    const builderId = builderIdStr ? parseInt(builderIdStr, 10) : undefined;
    const categoryId = categoryIdStr ? parseInt(categoryIdStr, 10) : undefined;
    return this.svc.findModels({ query, builderId, categoryId, take });
  }
}