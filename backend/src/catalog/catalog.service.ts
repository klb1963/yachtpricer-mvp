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

  // ✅ БЕЗ any: строго типизированный where
  async findModels(args: {
    query?: string;
    builderId?: number;
    categoryId?: number;
    take: number;
  }) {
    const { query, builderId, categoryId, take } = args;

    const where: Prisma.YachtModelWhereInput = {
      ...(query
        ? { name: { contains: query, mode: Prisma.QueryMode.insensitive } }
        : {}),
      ...(builderId ? { builderId } : {}),
      ...(categoryId ? { categoryId } : {}),
    };

    const items = await this.prisma.yachtModel.findMany({
      where,
      select: { id: true, name: true, builderId: true, categoryId: true },
      take,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return { items };
  }

  // ✅ БЕЗ any: RegionWhereInput и OR-фильтры типобезопасно
  async findRegions(params: {
    query?: string;
    countryCode?: string;
    take?: number;
    skip?: number;
  }) {
    const { query, countryCode, take = 20, skip = 0 } = params;

    const or: Prisma.RegionWhereInput[] = [];
    if (query && query.trim()) {
      or.push(
        { nameEn: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { nameRu: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { nameDe: { contains: query, mode: Prisma.QueryMode.insensitive } },
      );
    }

    const where: Prisma.RegionWhereInput = {
      ...(or.length ? { OR: or } : {}),
      ...(countryCode ? { country: { code2: countryCode.toUpperCase() } } : {}),
    };

    const itemsRaw = await this.prisma.region.findMany({
      where,
      take,
      skip,
      orderBy: [{ nameEn: 'asc' }, { nameRu: 'asc' }],
      include: { country: { select: { code2: true } } },
    });

    const items = itemsRaw.map((r) => ({
      id: r.id,
      nameEn: r.nameEn ?? null,
      nameRu: r.nameRu ?? null,
      nameDe: r.nameDe ?? null,
      countryCode: r.country?.code2 ?? null,
    }));

    return { items };
  }
}
