// backend/src/catalog/catalog.service.ts

import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findCategories(query: string, take: number) {
    const where: Prisma.YachtCategoryWhereInput = query
      ? {
          OR: [
            { nameEn: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { nameRu: { contains: query, mode: Prisma.QueryMode.insensitive } },
            // опционально: поиск по JSON "names"
            { names: { path: ['textEN'], string_contains: query } } as any,
            { names: { path: ['textRU'], string_contains: query } } as any,
          ],
        }
      : {};

    const items = await this.prisma.yachtCategory.findMany({
      where,
      select: { id: true, nameEn: true, nameRu: true },
      take,
      orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
    });
    return { items };
  }

  async findBuilders(query: string, take: number) {
    const where = query
      ? { name: { contains: query, mode: Prisma.QueryMode.insensitive } }
      : {};
    const items = await this.prisma.yachtBuilder.findMany({
      where,
      select: { id: true, name: true },
      take,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return { items };
  }

  async findModels(args: {
    query?: string;
    builderId?: number;
    categoryId?: number;
    take: number;
  }) {
    const { query, builderId, categoryId, take } = args;
    const where: any = {};
    if (query)
      where.name = { contains: query, mode: Prisma.QueryMode.insensitive };
    if (builderId) where.builderId = builderId;
    if (categoryId) where.categoryId = categoryId;

    const items = await this.prisma.yachtModel.findMany({
      where,
      select: { id: true, name: true, builderId: true, categoryId: true },
      take,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return { items };
  }
}