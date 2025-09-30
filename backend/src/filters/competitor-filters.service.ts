// backend/src/filters/competitor-filters.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateCompetitorFiltersDto } from './dto/update-competitor-filters.dto';

@Injectable()
export class CompetitorFiltersService {
  constructor(private readonly prisma: PrismaService) {}

  // безопасный коалесцер чисел
  private num(v: unknown, def: number): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : def;
  }

  // из DTO (string[] | number[]) → number[] для connect
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
    // если явно просят USER и есть userId — пробуем персональный
    if (scope === 'USER' && userId) {
      const u = await this.prisma.competitorFilters.findFirst({
        where: { orgId, scope: 'USER', userId },
        include: {
          locations: true,
          categories: true,
          builders: true,
          models: true,
          regions: true,
        },
      });
      if (u) return u;
    }

    // иначе — организационный (userId = null). ВАЖНО: findFirst, не findUnique.
    return this.prisma.competitorFilters.findFirst({
      where: { orgId, scope: 'ORG', userId: null },
      include: {
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
    dto: UpdateCompetitorFiltersDto,
  ) {
    // ⛏️ prisma-тип + строковый дефолт
    const scope: Prisma.CompetitorFiltersCreateInput['scope'] =
      dto.scope ?? 'USER';

    if (scope === 'USER' && !userId) {
      throw new BadRequestException('userId is required when scope is USER');
    }

    const defaults = {
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

    // важно: без явной аннотации UpdateInput, чтобы сюда "не протек" scope
    const commonFields = {
      lenFtMinus: n(dto.lenFtMinus, defaults.lenFtMinus),
      lenFtPlus: n(dto.lenFtPlus, defaults.lenFtPlus),
      yearMinus: n(dto.yearMinus, defaults.yearMinus),
      yearPlus: n(dto.yearPlus, defaults.yearPlus),
      peopleMinus: n(dto.peopleMinus, defaults.peopleMinus),
      peoplePlus: n(dto.peoplePlus, defaults.peoplePlus),
      cabinsMinus: n(dto.cabinsMinus, defaults.cabinsMinus),
      cabinsPlus: n(dto.cabinsPlus, defaults.cabinsPlus),
      headsMin: n(dto.headsMin, defaults.headsMin),
      updatedBy: userId ?? null,
    };

    // ищем существующую запись (PERSONAL или ORG) — findFirst
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
          data: {
            orgId,
            scope, // ⛏️ уже строка 'USER' | 'ORG'
            userId: scope === 'USER' ? userId! : null, // ⛏️ сравнение со строкой
            ...commonFields,
          },
        });

    // ===== СИНХРОНИЗАЦИЯ M2M-СВЯЗЕЙ (только если поля присланы) =====

    // Locations (string id)
    if (Array.isArray(dto.locationIds)) {
      const locIds = dto.locationIds;
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
    if (Array.isArray(dto.categoryIds)) {
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
    if (Array.isArray(dto.builderIds)) {
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
    if (Array.isArray(dto.modelIds)) {
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
    if (Array.isArray(dto.regionIds)) {
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

    return this.prisma.competitorFilters.findUnique({
      where: { id: saved.id },
      include: {
        locations: true,
        categories: true,
        builders: true,
        models: true,
        regions: true,
      },
    });
  }
}
