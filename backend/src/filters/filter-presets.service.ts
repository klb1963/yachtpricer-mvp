// backend/src/filters/filter-presets.service.ts

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, FilterScope } from '@prisma/client';

// Это "сырой" вход от контроллера при создании/обновлении пресета.
// Т.е. то, что реально приходит в body из фронтенда.
type PresetInput = {
  name?: string;
  scope?: FilterScope;
  countryIds?: string[];
  regionIds?: number[];
  locationIds?: string[];
  categoryIds?: number[];
  builderIds?: number[];
  modelIds?: number[];
  lenFtMinus?: number;
  lenFtPlus?: number;
  yearMinus?: number;
  yearPlus?: number;
  peopleMinus?: number;
  peoplePlus?: number;
  cabinsMinus?: number;
  cabinsPlus?: number;
  headsMin?: number;
};

@Injectable()
export class FilterPresetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, userId?: string) {
    return this.prisma.competitorFilterPreset.findMany({
      where: {
        orgId,
        OR: [{ scope: 'ORG' }, { scope: 'USER', userId: userId ?? undefined }],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOne(orgId: string, id: string) {
    const preset = await this.prisma.competitorFilterPreset.findFirst({
      where: { id, orgId },
    });
    if (!preset) throw new BadRequestException('Preset not found');
    return preset;
  }

  async create(orgId: string, userId: string | undefined, body: PresetInput) {
    // 1. Валидация
    if (!body.name || body.name.trim() === '') {
      throw new BadRequestException('Preset name is required');
    }

    const scope: FilterScope = body.scope ?? 'USER';
    if (scope === 'USER' && !userId) {
      throw new BadRequestException('userId is required for USER scope');
    }

    // 2. Prisma ожидает CompetitorFilterPresetCreateInput:
    // {
    //   org: { connect: { id } },
    //   user?: { connect: { id } },
    //   scope,
    //   name,
    //   countryIds: [],
    //   ...
    // }
    // Мы собираем это здесь.
    const data: Prisma.CompetitorFilterPresetCreateInput = {
      scope,
      name: body.name.trim(),

      // массивы: если undefined -> ставим пустой массив, чтобы не было null
      countryIds: body.countryIds ?? [],
      regionIds: body.regionIds ?? [],
      locationIds: body.locationIds ?? [],
      categoryIds: body.categoryIds ?? [],
      builderIds: body.builderIds ?? [],
      modelIds: body.modelIds ?? [],

      lenFtMinus: body.lenFtMinus ?? 3,
      lenFtPlus: body.lenFtPlus ?? 3,
      yearMinus: body.yearMinus ?? 2,
      yearPlus: body.yearPlus ?? 2,
      peopleMinus: body.peopleMinus ?? 1,
      peoplePlus: body.peoplePlus ?? 1,
      cabinsMinus: body.cabinsMinus ?? 1,
      cabinsPlus: body.cabinsPlus ?? 1,
      headsMin: body.headsMin ?? 1,

      org: {
        connect: { id: orgId },
      },

      // user connect только если scope=USER
      ...(scope === 'USER' && userId
        ? {
            user: {
              connect: { id: userId },
            },
          }
        : {}),
    };

    return this.prisma.competitorFilterPreset.create({ data });
  }

  async update(
    orgId: string,
    userId: string | undefined,
    id: string,
    body: PresetInput,
  ) {
    // 1. Найдём существующий пресет и проверим доступ
    const existing = await this.prisma.competitorFilterPreset.findFirst({
      where: { id, orgId },
      select: { id: true, scope: true, userId: true },
    });
    if (!existing) {
      throw new BadRequestException('Preset not found in this org');
    }

    if (existing.scope === 'USER' && existing.userId !== userId) {
      throw new BadRequestException('Forbidden');
    }

    // 2. Собираем updateInput. Здесь можно частично обновлять.
    const data: Prisma.CompetitorFilterPresetUpdateInput = {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),

      ...(body.scope !== undefined ? { scope: body.scope } : {}),

      ...(body.countryIds !== undefined ? { countryIds: body.countryIds } : {}),

      ...(body.regionIds !== undefined ? { regionIds: body.regionIds } : {}),

      ...(body.locationIds !== undefined
        ? { locationIds: body.locationIds }
        : {}),

      ...(body.categoryIds !== undefined
        ? { categoryIds: body.categoryIds }
        : {}),

      ...(body.builderIds !== undefined ? { builderIds: body.builderIds } : {}),

      ...(body.modelIds !== undefined ? { modelIds: body.modelIds } : {}),

      ...(body.lenFtMinus !== undefined ? { lenFtMinus: body.lenFtMinus } : {}),

      ...(body.lenFtPlus !== undefined ? { lenFtPlus: body.lenFtPlus } : {}),

      ...(body.yearMinus !== undefined ? { yearMinus: body.yearMinus } : {}),

      ...(body.yearPlus !== undefined ? { yearPlus: body.yearPlus } : {}),

      ...(body.peopleMinus !== undefined
        ? { peopleMinus: body.peopleMinus }
        : {}),

      ...(body.peoplePlus !== undefined ? { peoplePlus: body.peoplePlus } : {}),

      ...(body.cabinsMinus !== undefined
        ? { cabinsMinus: body.cabinsMinus }
        : {}),

      ...(body.cabinsPlus !== undefined ? { cabinsPlus: body.cabinsPlus } : {}),

      ...(body.headsMin !== undefined ? { headsMin: body.headsMin } : {}),
    };

    return this.prisma.competitorFilterPreset.update({
      where: { id },
      data,
    });
  }

  async remove(orgId: string, id: string) {
    // deleteMany чтобы не кидать исключение, если не нашлось
    return this.prisma.competitorFilterPreset.deleteMany({
      where: { id, orgId },
    });
  }
}
