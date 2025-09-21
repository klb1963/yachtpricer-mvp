// backend/src/filters/competitor-filters.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilterScope } from '@prisma/client';
import { UpdateCompetitorFiltersDto } from './dto/update-competitor-filters.dto';

@Injectable()
export class CompetitorFiltersService {
  constructor(private readonly prisma: PrismaService) {}

  // безопасный коалесцер чисел
  private num(v: unknown, def: number): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : def;
  }

  async getForCurrent(
    orgId: string,
    userId?: string,
    scope: FilterScope = FilterScope.USER,
  ) {
    // если явно просят USER и есть userId — пробуем персональный
    if (scope === FilterScope.USER && userId) {
      const u = await this.prisma.competitorFilters.findFirst({
        where: { orgId, scope: FilterScope.USER, userId },
        include: { locations: true },
      });
      if (u) return u;
    }

    // иначе — организационный (userId = null). ВАЖНО: findFirst, не findUnique.
    return this.prisma.competitorFilters.findFirst({
      where: { orgId, scope: FilterScope.ORG, userId: null },
      include: { locations: true },
    });
  }

  async upsert(
    orgId: string,
    userId: string | undefined,
    dto: UpdateCompetitorFiltersDto,
  ) {
    const scope: FilterScope = dto.scope ?? FilterScope.USER;

    if (scope === FilterScope.USER && !userId) {
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
      headsMin: 1, // по умолчанию 1 (как просили)
    };

    const n = this.num.bind(this);

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

    // ищем существующую запись (PERSONAL или ORG) — findFirst вместо уникального ключа
    const existing = await this.prisma.competitorFilters.findFirst({
      where:
        scope === FilterScope.USER
          ? { orgId, scope: FilterScope.USER, userId: userId! }
          : { orgId, scope: FilterScope.ORG, userId: null },
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
            scope,
            userId: scope === FilterScope.USER ? userId! : null,
            ...commonFields,
          },
        });

    // синхронизируем связи локаций (если фронт прислал)
    const locIds = dto.locationIds ?? null;

    if (Array.isArray(locIds)) {
      // прислали массив (в т.ч. пустой) → явно синхронизируем
      await this.prisma.competitorFilters.update({
        where: { id: saved.id },
        data: {
          locations: {
            set: [], // сначала очищаем
            ...(locIds.length ? { connect: locIds.map((id) => ({ id })) } : {}), // если массив пустой — просто очистим
          },
        },
      });
    }

    return this.prisma.competitorFilters.findUnique({
      where: { id: saved.id },
      include: { locations: true },
    });
  }
}
