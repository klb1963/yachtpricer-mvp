// backend/src/catalog/catalog.service.ts

import { Prisma, LocationSource } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== categories =====
  async findCategories(
    query: string,
    take: number,
  ): Promise<{
    items: Array<{ id: number; nameEn: string | null; nameRu: string | null }>;
  }> {
    const where: Prisma.YachtCategoryWhereInput = query
      ? {
          OR: [
            { nameEn: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { nameRu: { contains: query, mode: Prisma.QueryMode.insensitive } },
            // поиск по JSON "names" (у Prisma тут any, оставляем каст)
            { names: { path: ['textEN'], string_contains: query } } as any,
            { names: { path: ['textRU'], string_contains: query } } as any,
          ],
        }
      : {};

    const itemsRaw = await this.prisma.yachtCategory.findMany({
      where,
      select: { id: true, nameEn: true, nameRu: true },
      take,
      orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
    });

    const items = itemsRaw.map((c) => ({
      id: c.id,
      nameEn: c.nameEn ?? null,
      nameRu: c.nameRu ?? null,
    }));

    return { items };
  }

  // ===== builders =====
  async findBuilders(
    query: string,
    take: number,
  ): Promise<{ items: Array<{ id: number; name: string }> }> {
    const where: Prisma.YachtBuilderWhereInput = query
      ? { name: { contains: query, mode: Prisma.QueryMode.insensitive } }
      : {};

    const itemsRaw = await this.prisma.yachtBuilder.findMany({
      where,
      select: { id: true, name: true },
      take,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    const items = itemsRaw.map((b) => ({
      id: b.id,
      name: b.name,
    }));

    return { items };
  }

  // ===== models =====
  async findModels(args: {
    query?: string;
    builderId?: number;
    categoryId?: number;
    take: number;
  }): Promise<{
    items: Array<{
      id: number;
      name: string;
      builderId: number | null;
      categoryId: number | null;
    }>;
  }> {
    const { query, builderId, categoryId, take } = args;

    const where: Prisma.YachtModelWhereInput = {
      ...(query
        ? { name: { contains: query, mode: Prisma.QueryMode.insensitive } }
        : {}),
      ...(builderId ? { builderId } : {}),
      ...(categoryId ? { categoryId } : {}),
    };

    const itemsRaw = await this.prisma.yachtModel.findMany({
      where,
      select: { id: true, name: true, builderId: true, categoryId: true },
      take,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    const items = itemsRaw.map((m) => ({
      id: m.id,
      name: m.name,
      builderId: m.builderId ?? null,
      categoryId: m.categoryId ?? null,
    }));

    return { items };
  }

  // ===== legacy regions search by countryCode / free text (оставляем, если кто-то ещё вызывает) =====
  async findRegions(params: {
    query?: string;
    countryCode?: string;
    take?: number;
    skip?: number;
  }): Promise<{
    items: Array<{
      id: number;
      nameEn: string | null;
      nameRu: string | null;
      nameDe: string | null;
      countryCode: string | null;
    }>;
  }> {
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

  // ===== NEW: countries for cascader =====
  async findCountries(): Promise<{
    items: Array<{ id: string; code2: string; name: string }>;
  }> {
    const itemsRaw = await this.prisma.country.findMany({
      select: {
        id: true, // UUID
        code2: true, // "HR"
        name: true, // "Croatia"
      },
      orderBy: { name: 'asc' },
    });

    const items = itemsRaw.map((c) => ({
      id: c.id,
      code2: c.code2,
      name: c.name,
    }));

    return { items };
  }

  // ===== NEW: regions for cascader =====
  async findRegionsCascade(args: {
    countryIds: string[]; // UUID[] стран
    take: number;
  }): Promise<{
    items: Array<{
      id: number;
      nameEn: string | null;
      nameRu: string | null;
      nameDe: string | null;
      countryId: string | null;
      country: { code2: string; name: string } | null;
    }>;
  }> {
    const { countryIds, take } = args;

    if (!countryIds.length) {
      return {
        items: [],
      };
    }

    const raw = await this.prisma.region.findMany({
      where: {
        countryId: { in: countryIds },
      },
      take,
      orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
      include: {
        country: {
          select: { id: true, code2: true, name: true },
        },
      },
    });

    const items = raw.map((r) => ({
      id: r.id,
      nameEn: r.nameEn ?? null,
      nameRu: r.nameRu ?? null,
      nameDe: r.nameDe ?? null,
      countryId: r.countryId ?? null,
      country: r.country
        ? {
            code2: r.country.code2,
            name: r.country.name,
          }
        : null,
    }));

    return { items };
  }

  // ===== NEW: locations for cascader =====
  async findLocationsCascade(args: {
    countryIds: string[]; // UUID[] стран
    regionIds: number[]; // PK регионов
    source?: string; // 'NAUSYS' | 'INTERNAL' | undefined
    take: number;
  }): Promise<{
    items: Array<{
      id: string;
      name: string;
      regionId: number | null;
      regionName: string | null;
      countryId: string | null;
      country: { code2: string; name: string } | null;
    }>;
    total: number;
  }> {
    const { countryIds, regionIds, source, take } = args;

    // базовый where
    const where: Prisma.LocationWhereInput = {};

    // фильтр по источнику (если задан)
    if (source && source.trim()) {
      const srcUpper = source.trim().toUpperCase();
      if (
        srcUpper === LocationSource.NAUSYS ||
        srcUpper === LocationSource.INTERNAL
      ) {
        // Prisma ожидает enum LocationSource
        where.source = srcUpper as LocationSource;
      }
    }

    // каскад географии
    if (regionIds.length > 0) {
      // выбраны регионы → берём только эти регионы
      where.regionId = { in: regionIds };
    } else if (countryIds.length > 0) {
      // регионы не выбраны, но выбраны страны → все локации этих стран
      where.countryId = { in: countryIds };
    } else {
      // ничего не выбрано → пусто, чтобы не лить весь Earth
      return {
        items: [],
        total: 0,
      };
    }

    const rows = await this.prisma.location.findMany({
      where,
      take,
      orderBy: [{ name: 'asc' }],
      include: {
        region: {
          select: {
            id: true,
            nameEn: true,
          },
        },
        country: {
          select: {
            id: true,
            code2: true,
            name: true,
          },
        },
      },
    });

    const items = rows.map((l) => ({
      id: l.id,
      name: l.name,
      regionId: l.region?.id ?? null,
      regionName: l.region?.nameEn ?? null,
      countryId: l.countryId ?? null,
      country: l.country
        ? {
            code2: l.country.code2,
            name: l.country.name,
          }
        : null,
    }));

    return {
      items,
      total: items.length,
    };
  }
}
