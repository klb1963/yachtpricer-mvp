// backend/src/filters/competitor-filters.service.ts

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, $Enums } from '@prisma/client';
import { CompetitorFiltersBody } from './dto/competitor-filters.dto'; // валидированный DTO из контроллера

type Defaults = {
  lenFtMinus: number;
  lenFtPlus: number;
  yearMinus: number;
  yearPlus: number;
  peopleMinus: number;
  peoplePlus: number;
  cabinsMinus: number;
  cabinsPlus: number;
  headsMin: number;
};

@Injectable()
export class CompetitorFiltersService {
  constructor(private readonly prisma: PrismaService) {}

  // безопасный коалесцер чисел
  private num(v: unknown, def: number): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : def;
  }

  // helper: dto.regionIds / dto.categoryIds / ... → number[]
  private toIntIds(ids?: Array<string | number>): number[] {
    if (!Array.isArray(ids)) return [];
    return ids
      .map((v) => (typeof v === 'string' ? Number(v) : v))
      .filter((n): n is number => Number.isFinite(n) && Number.isInteger(n));
  }

  async getForCurrent(
    orgId: string,
    userId?: string,
    // ⛏️ используем точный prisma-тип и дефолт-литерал
    scope: Prisma.CompetitorFiltersWhereInput['scope'] = 'USER',
  ) {
    if (scope === 'USER' && userId) {
      const u = await this.prisma.competitorFilters.findFirst({
        where: { orgId, scope: 'USER', userId },
        include: {
          countries: true,
          locations: true,
          categories: true,
          builders: true,
          models: true,
          regions: true,
        },
      });
      if (u) return u;
    }

    return this.prisma.competitorFilters.findFirst({
      where: { orgId, scope: 'ORG', userId: null },
      include: {
        countries: true,
        locations: true,
        categories: true,
        builders: true,
        models: true,
        regions: true,
      },
    });
  }

  async reset(
    orgId: string,
    userId: string | undefined,
    scope: $Enums.FilterScope = 'USER',
  ) {
    if (scope === 'USER' && !userId) {
      throw new BadRequestException('userId is required when scope is USER');
    }

    // найдём запись как в upsert()
    const existing = await this.prisma.competitorFilters.findFirst({
      where:
        scope === 'USER'
          ? { orgId, scope: 'USER', userId: userId! }
          : { orgId, scope: 'ORG', userId: null },
      select: { id: true },
    });

    // если нет — создать пустую с дефолтами
    const saved =
      existing ??
      (await this.prisma.competitorFilters.create({
        data: {
          scope,
          org: { connect: { id: orgId } },
          ...(userId && scope === 'USER'
            ? { user: { connect: { id: userId } } }
            : {}),
          lenFtMinus: 3,
          lenFtPlus: 3,
          yearMinus: 2,
          yearPlus: 2,
          peopleMinus: 1,
          peoplePlus: 1,
          cabinsMinus: 1,
          cabinsPlus: 1,
          headsMin: 1,
        },
      }));

    // очистить все M2M
    await this.prisma.competitorFilters.update({
      where: { id: saved.id },
      data: {
        countries: { set: [] },
        locations: { set: [] },
        categories: { set: [] },
        builders: { set: [] },
        models: { set: [] },
        regions: { set: [] },
      },
    });

    return this.prisma.competitorFilters.findUnique({
      where: { id: saved.id },
      include: {
        countries: true,
        locations: true,
        categories: true,
        builders: true,
        models: true,
        regions: true,
      },
    });
  }

  async upsert(
    orgId: string,
    userId: string | undefined,
    dto: CompetitorFiltersBody, // ⬅️ был UpdateCompetitorFiltersDto
  ) {
    const scope: $Enums.FilterScope = dto.scope ?? 'USER';

    if (scope === 'USER' && !userId) {
      throw new BadRequestException('userId is required when scope is USER');
    }

    // дефолты «отклонений/диапазонов»
    const defaults: Defaults = {
      lenFtMinus: 3,
      lenFtPlus: 3,
      yearMinus: 2,
      yearPlus: 2,
      peopleMinus: 1,
      peoplePlus: 1,
      cabinsMinus: 1,
      cabinsPlus: 1,
      headsMin: 1,
    };

    const n = this.num.bind(this);

    // общие поля (в т.ч. countries, если у тебя есть scalar column в модели)
    const commonFields: Prisma.CompetitorFiltersUpdateInput = {
      // ⬇️ если в Prisma-модели есть поле `countries String[]` — сохраним
      lenFtMinus: n(dto.lenFtMinus, defaults.lenFtMinus),
      lenFtPlus: n(dto.lenFtPlus, defaults.lenFtPlus),
      yearMinus: n(dto.yearMinus, defaults.yearMinus),
      yearPlus: n(dto.yearPlus, defaults.yearPlus),
      peopleMinus: n(dto.peopleMinus, defaults.peopleMinus),
      peoplePlus: n(dto.peoplePlus, defaults.peoplePlus),
      cabinsMinus: n(dto.cabinsMinus, defaults.cabinsMinus),
      cabinsPlus: n(dto.cabinsPlus, defaults.cabinsPlus),
      headsMin: n(dto.headsMin, defaults.headsMin),
    };

    // ищем существующую запись (PERSONAL или ORG)
    const existing = await this.prisma.competitorFilters.findFirst({
      where:
        scope === 'USER'
          ? { orgId, scope: 'USER', userId: userId! }
          : { orgId, scope: 'ORG', userId: null },
      select: { id: true },
    });

    const saved = existing
      ? await this.prisma.competitorFilters.update({
          where: { id: existing.id },
          data: commonFields,
        })
      : await this.prisma.competitorFilters.create({
          // ✅ В CreateInput связи задаём через connect
          data: {
            scope, // $Enums.FilterScope
            org: { connect: { id: orgId } },
            ...(userId && scope === 'USER'
              ? { user: { connect: { id: userId } } }
              : {}),
            // Преобразуем commonFields к CreateInput-форме
            // (UpdateInput совместим по большинству скаляров; отношения — отдельно)
            ...(commonFields as Omit<
              Prisma.CompetitorFiltersCreateInput,
              'org' | 'user'
            >),
          },
        });

    // ===== СИНХРОНИЗАЦИЯ M2M-СВЯЗЕЙ (только если поле прислано в DTO) =====

    // Countries: dto.countryIds (UUID[] стран)
    if (dto.countryIds !== undefined) {
      const ids = dto.countryIds ?? [];
      await this.prisma.competitorFilters.update({
        where: { id: saved.id },
        data: {
          countries: {
            set: [],
            ...(ids.length ? { connect: ids.map((id) => ({ id })) } : {}),
          },
        },
      });
    }

    // Locations (string id)
    if (dto.locationIds !== undefined) {
      const locIds = dto.locationIds ?? [];
      await this.prisma.competitorFilters.update({
        where: { id: saved.id },
        data: {
          locations: {
            set: [],
            ...(locIds.length ? { connect: locIds.map((id) => ({ id })) } : {}),
          },
        },
      });
    }

    // Categories (int id)
    if (dto.categoryIds !== undefined) {
      const ids = this.toIntIds(dto.categoryIds);
      await this.prisma.competitorFilters.update({
        where: { id: saved.id },
        data: {
          categories: {
            set: [],
            ...(ids.length ? { connect: ids.map((id) => ({ id })) } : {}),
          },
        },
      });
    }

    // Builders (int id)
    if (dto.builderIds !== undefined) {
      const ids = this.toIntIds(dto.builderIds);
      await this.prisma.competitorFilters.update({
        where: { id: saved.id },
        data: {
          builders: {
            set: [],
            ...(ids.length ? { connect: ids.map((id) => ({ id })) } : {}),
          },
        },
      });
    }

    // Models (int id)
    if (dto.modelIds !== undefined) {
      const ids = this.toIntIds(dto.modelIds);
      await this.prisma.competitorFilters.update({
        where: { id: saved.id },
        data: {
          models: {
            set: [],
            ...(ids.length ? { connect: ids.map((id) => ({ id })) } : {}),
          },
        },
      });
    }

    // Regions (int id)
    if (dto.regionIds !== undefined) {
      const ids = this.toIntIds(dto.regionIds);
      await this.prisma.competitorFilters.update({
        where: { id: saved.id },
        data: {
          regions: {
            set: [],
            ...(ids.length ? { connect: ids.map((id) => ({ id })) } : {}),
          },
        },
      });
    }
    // ===== КОНЕЦ СИНХРОНИЗАЦИИ M2M-СВЯЗЕЙ =====
    return this.prisma.competitorFilters.findUnique({
      where: { id: saved.id },
      include: {
        countries: true,
        locations: true,
        categories: true,
        builders: true,
        models: true,
        regions: true,
      },
    });
  }

  /**
   * Подсчёт количества яхт под заданные фильтры.
   * Здесь считаем так же, как будет фильтровать реальный Scan:
   * - orgId обязательно
   * - гео: locationIds > regionIds > countryIds
   * - категории/билдеры/модели
   * - headsMin (если задан)
   */
  async testCount(
    orgId: string,
    _userId: string | undefined,
    dto: CompetitorFiltersBody,
  ): Promise<number> {
    const countryIds =
      dto.countryIds?.filter((id): id is string => !!id && id.length > 0) ?? [];

    const regionIds = Array.isArray(dto.regionIds) ? dto.regionIds : [];
    const locationIds =
      dto.locationIds?.filter((id): id is string => !!id && id.length > 0) ??
      [];

    const categoryIds = Array.isArray(dto.categoryIds) ? dto.categoryIds : [];
    const builderIds = Array.isArray(dto.builderIds) ? dto.builderIds : [];
    const modelIds = Array.isArray(dto.modelIds) ? dto.modelIds : [];

    const hasHeadsMin = typeof dto.headsMin === 'number';

    // ✅ теперь снова фильтруем по orgId
    const where: Prisma.YachtWhereInput = {
      orgId,
    };

    // --- Гео: locationIds → regionIds → countryIds ---
    if (locationIds.length) {
      where.locationId = { in: locationIds };
    } else if (regionIds.length) {
      where.locationRef = {
        is: {
          regionId: { in: regionIds },
        },
      };
    } else if (countryIds.length) {
      where.countryId = { in: countryIds };
    }

    // --- Категория / билдер / модель ---
    if (categoryIds.length) {
      where.categoryId = { in: categoryIds };
    }

    if (builderIds.length) {
      where.builderId = { in: builderIds };
    }

    if (modelIds.length) {
      where.yachtModelId = { in: modelIds };
    }

    // --- Heads min ---
    if (hasHeadsMin) {
      where.heads = { gte: dto.headsMin };
    }

    return this.prisma.yacht.count({ where });
  }
}
