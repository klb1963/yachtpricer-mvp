// backend/src/yachts.controller.ts

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma, YachtType } from '@prisma/client';
import { Roles } from './auth/roles.decorator';
import { PrismaService } from './prisma/prisma.service';

interface YachtWithCountry
  extends Prisma.YachtGetPayload<{
    include: { country: true; category: true; builder: true };
  }> {
  countryCode: string | null;
  countryName: string | null;
}

interface PriceHistoryItemDto {
  date: string; // PriceHistory.date
  weekStart: string; // WeekSlot.startDate
  price: number;
  discountPct: number;
  source: string | null;
  note: string | null;
}

interface YachtDetailsDto extends YachtWithCountry {
  currentPrice: number | null;
  currentDiscountPct: number | null;
  currentPriceUpdatedAt: string | null;
  priceHistory: PriceHistoryItemDto[];
}

/** Хелперы парсинга */
const toInt = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isInteger(n) ? n : undefined;
};

const toNullableStr = (v: unknown): string | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === 'string') {
    const s = v.trim();
    return s === '' ? null : s;
  }
  return undefined;
};

const toNullableInt = (v: unknown): number | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

const toNum = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

// number | null | undefined:
//   undefined → поле не трогаем//   null      → явно сбрасываем в null
//   number    → сохраняем число
const toNullableNum = (v: unknown): number | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b);

@Controller('yachts')
export class YachtsController {
  constructor(private readonly prisma: PrismaService) {}

  // -------- list --------
  @Get()
  async list(
    @Query()
    query: {
      q?: string;
      type?: string;
      minYear?: string;
      maxYear?: string;
      minPrice?: string;
      maxPrice?: string;
      categoryId?: string;
      sort?: 'priceAsc' | 'priceDesc' | 'yearAsc' | 'yearDesc' | 'createdDesc';
      page?: string;
      pageSize?: string;
    },
  ) {
    const q = (query.q ?? '').trim();
    const typeEnum = query.type as YachtType | undefined;

    const minYear = toInt(query.minYear);
    const maxYear = toInt(query.maxYear);
    const minPrice = toNum(query.minPrice);
    const maxPrice = toNum(query.maxPrice);
    const categoryId = toInt(query.categoryId);

    const page = clamp(toInt(query.page) ?? 1, 1, 10_000);
    const pageSize = clamp(toInt(query.pageSize) ?? 20, 1, 200);
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const andClauses: Array<Prisma.YachtWhereInput | undefined> = [
      q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { manufacturer: { contains: q, mode: 'insensitive' } },
              { model: { contains: q, mode: 'insensitive' } },
              { location: { contains: q, mode: 'insensitive' } },
              { charterCompany: { contains: q, mode: 'insensitive' } },
              { ownerName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,

      typeEnum ? { type: typeEnum } : undefined,

      minYear !== undefined ? { builtYear: { gte: minYear } } : undefined,
      maxYear !== undefined ? { builtYear: { lte: maxYear } } : undefined,
      minPrice !== undefined
        ? { basePrice: { gte: String(minPrice) } }
        : undefined,
      maxPrice !== undefined
        ? { basePrice: { lte: String(maxPrice) } }
        : undefined,
      categoryId !== undefined ? { categoryId } : undefined,
    ];

    const where: Prisma.YachtWhereInput = {
      AND: andClauses.filter((x): x is Prisma.YachtWhereInput => Boolean(x)),
    };

    let orderBy:
      | Prisma.YachtOrderByWithRelationInput
      | Prisma.YachtOrderByWithRelationInput[] = { createdAt: 'desc' };

    switch (query.sort) {
      case 'priceAsc':
        orderBy = [{ basePrice: 'asc' }, { createdAt: 'desc' }];
        break;
      case 'priceDesc':
        orderBy = [{ basePrice: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'yearAsc':
        orderBy = [{ builtYear: 'asc' }, { createdAt: 'desc' }];
        break;
      case 'yearDesc':
        orderBy = [{ builtYear: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'createdDesc':
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.yacht.count({ where }),
      this.prisma.yacht.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          country: { select: { code2: true, name: true } },
          category: { select: { nameEn: true, nameRu: true, nameDe: true } },
        },
      }),
    ]);

    const mapped = items.map((y) => ({
      ...y,
      countryCode: y.country?.code2 ?? null,
      countryName: y.country?.name ?? null,
    }));

    return { items: mapped, total, page, pageSize };
  }

  // -------- by id --------
  @Get(':id')
  async byId(@Param('id') id: string): Promise<YachtDetailsDto> {
    const y = await this.prisma.yacht.findUnique({
      where: { id },
      include: {
        country: true,
        category: true,
        builder: true,
      },
    });
    if (!y) throw new NotFoundException('Yacht not found');

    // --- История за последний год (можно потом параметризовать) ---
    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setFullYear(now.getFullYear() - 1);

    const history = await this.prisma.priceHistory.findMany({
      where: {
        weekSlot: {
          yachtId: id,
        },
        date: {
          gte: yearAgo,
        },
      },
      orderBy: {
        date: 'asc', // для таблицы сверху-вниз во времени
      },
      include: {
        weekSlot: true,
      },
    });

    const last = history.length > 0 ? history[history.length - 1] : null;

    const currentPrice =
      last?.price != null ? Number(last.price as unknown as number) : null;
    const currentDiscountPct =
      last?.discount != null
        ? Number(last.discount as unknown as number)
        : null;
    const currentPriceUpdatedAt = last ? last.date.toISOString() : null;

    const priceHistory: PriceHistoryItemDto[] = history.map((h) => ({
      date: h.date.toISOString(),
      weekStart: h.weekSlot.startDate.toISOString(),
      price: Number(h.price as unknown as number),
      discountPct: Number(h.discount as unknown as number),
      source: (h.source as unknown as string) ?? null,
      note: h.note ?? null,
    }));

    return {
      ...y,
      countryCode: y.country?.code2 ?? null,
      countryName: y.country?.name ?? null,
      currentPrice,
      currentDiscountPct,
      currentPriceUpdatedAt,
      priceHistory,
    };
  }

  // ===== helpers =====
  private toStringStrict(v: unknown): string {
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try {
      return JSON.stringify(v);
    } catch {
      return '';
    }
  }

  private reqStr(body: Record<string, unknown>, k: string): string {
    const v = body[k];
    if (v === undefined || v === null || v === '')
      throw new BadRequestException(`Field "${k}" is required`);
    const s = this.toStringStrict(v);
    if (!s) throw new BadRequestException(`Field "${k}" is required`);
    return s;
  }

  private reqNum(body: Record<string, unknown>, k: string): number {
    const v = body[k];
    if (v === undefined || v === null || v === '')
      throw new BadRequestException(`Field "${k}" is required`);
    const n = Number(v as string | number);
    if (!Number.isFinite(n))
      throw new BadRequestException(`Field "${k}" must be a number`);
    return n;
  }

  private optStr(body: Record<string, unknown>, k: string): string | undefined {
    const v = body[k];
    if (v === undefined || v === null || v === '') return undefined;
    const s = this.toStringStrict(v);
    return s || undefined;
  }

  private isJsonInputValue(v: unknown): v is Prisma.InputJsonValue {
    try {
      JSON.stringify(v);
      return true;
    } catch {
      return false;
    }
  }

  private toJsonValueEnsure(v: unknown): Prisma.InputJsonValue {
    if (v === undefined || v === null || v === '') return [];
    if (typeof v === 'string') {
      try {
        const parsed: unknown = JSON.parse(v);
        return this.isJsonInputValue(parsed) ? parsed : [];
      } catch {
        return v;
      }
    }
    return this.isJsonInputValue(v) ? v : [];
  }

  private toJsonValueOptional(v: unknown): Prisma.InputJsonValue | undefined {
    if (v === undefined) return undefined;
    return this.toJsonValueEnsure(v);
  }

  // ===== create =====
  @Post()
  @Roles('MANAGER', 'ADMIN')
  async create(@Body() body: Record<string, unknown>) {
    type CreateBase = Omit<
      Prisma.YachtCreateInput,
      | 'currentExtraServices'
      | 'owner'
      | 'location'
      | 'type'
      | 'country'
      | 'category'
      | 'builder'
    >;

    const baseData: CreateBase = {
      name: this.reqStr(body, 'name'),
      manufacturer: '',
      model: this.reqStr(body, 'model'),
      fleet: this.reqStr(body, 'fleet'),
      charterCompany: this.reqStr(body, 'charterCompany'),
      length: this.reqNum(body, 'length'),
      builtYear: this.reqNum(body, 'builtYear'),
      cabins: this.reqNum(body, 'cabins'),
      heads: this.reqNum(body, 'heads'),
      basePrice: this.reqStr(body, 'basePrice'),
      ownerName: this.optStr(body, 'ownerName'),
    };

    const typeVal = this.optStr(body, 'type');
    const loc = this.optStr(body, 'location');

    const services = this.toJsonValueEnsure(body['currentExtraServices']);
    const ownerId = this.optStr(body, 'ownerId');

    const countryId = toNullableStr(body['countryId']);
    const categoryId = toNullableInt(body['categoryId']);
    const builderId = toNullableInt(body['builderId']);
    const maxDiscountPct = toNullableNum(body['maxDiscountPct']);

    let manufacturer: string | null | undefined = this.optStr(
      body,
      'manufacturer',
    );
    if (!manufacturer && typeof builderId === 'number') {
      const builder = await this.prisma.yachtBuilder.findUnique({
        where: { id: builderId },
        select: { name: true },
      });
      manufacturer = builder?.name ?? null;
    }
    if (!manufacturer) {
      throw new BadRequestException(
        'Either "manufacturer" or "builderId" must be provided',
      );
    }

    const data: Prisma.YachtCreateInput = {
      ...baseData,
      manufacturer,
      currentExtraServices: services,
      ...(typeVal ? { type: typeVal as YachtType } : {}),
      location: loc ?? '',
      ...(ownerId ? { owner: { connect: { id: ownerId } } } : {}),
      ...(countryId ? { country: { connect: { id: countryId } } } : {}),
      ...(typeof categoryId === 'number'
        ? { category: { connect: { id: categoryId } } }
        : {}),
      ...(typeof builderId === 'number'
        ? { builder: { connect: { id: builderId } } }
        : {}),
      ...(maxDiscountPct !== undefined ? { maxDiscountPct } : {}),
    };

    return this.prisma.yacht.create({ data });
  }

  // ===== update =====
  @Patch(':id')
  @Roles('MANAGER', 'ADMIN')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const exists = await this.prisma.yacht.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Yacht not found');

    const asStr = (k: string): string | undefined => this.optStr(body, k);
    const asNum = (k: string): number | undefined => {
      const v = body[k];
      if (v === undefined || v === null || v === '') return undefined;
      const n = Number(v as string | number);
      return Number.isFinite(n) ? n : undefined;
    };

    const data: Prisma.YachtUpdateInput = {
      name: asStr('name'),
      manufacturer: asStr('manufacturer'),
      model: asStr('model'),
      type: (() => {
        const s = asStr('type');
        return s ? (s as YachtType) : undefined;
      })(),
      location: asStr('location'),
      fleet: asStr('fleet'),
      charterCompany: asStr('charterCompany'),
      length: asNum('length'),
      builtYear: asNum('builtYear'),
      cabins: asNum('cabins'),
      heads: asNum('heads'),
      basePrice: asStr('basePrice'),
      ownerName: asStr('ownerName'),
    };

    // maxDiscountPct: number | null | undefined
    const maxDiscountPct = toNullableNum(body['maxDiscountPct']);
    if (maxDiscountPct !== undefined) {
      data.maxDiscountPct = maxDiscountPct;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'currentExtraServices')) {
      const val = this.toJsonValueOptional(body['currentExtraServices']);
      if (val !== undefined) data.currentExtraServices = val;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'ownerId')) {
      const idStr = asStr('ownerId');
      if (idStr) data.owner = { connect: { id: idStr } };
    }

    if (Object.prototype.hasOwnProperty.call(body, 'countryId')) {
      const v = toNullableStr(body['countryId']);
      let countryUpdate: Prisma.YachtUpdateInput['country'];
      if (v === null) {
        countryUpdate = { disconnect: true };
      } else if (typeof v === 'string' && v) {
        countryUpdate = { connect: { id: v } };
      }
      if (countryUpdate) data.country = countryUpdate;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'categoryId')) {
      const v = toNullableInt(body['categoryId']);
      let categoryUpdate: Prisma.YachtUpdateInput['category'];
      if (v === null) {
        categoryUpdate = { disconnect: true };
      } else if (typeof v === 'number') {
        categoryUpdate = { connect: { id: v } };
      }
      if (categoryUpdate) data.category = categoryUpdate;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'builderId')) {
      const v = toNullableInt(body['builderId']);
      let builderUpdate: Prisma.YachtUpdateInput['builder'];
      if (v === null) {
        builderUpdate = { disconnect: true };
      } else if (typeof v === 'number') {
        builderUpdate = { connect: { id: v } };
      }
      if (builderUpdate) data.builder = builderUpdate;
    }

    (Object.keys(data) as Array<keyof Prisma.YachtUpdateInput>).forEach((k) => {
      if (data[k] === undefined) delete data[k];
    });

    return this.prisma.yacht.update({
      where: { id },
      data,
      include: {
        country: { select: { id: true, code2: true, name: true } },
        category: { select: { id: true, nameEn: true, nameRu: true } },
        builder: { select: { id: true, name: true } },
      },
    });
  }

  // ===== delete =====
  @Delete(':id')
  @Roles('MANAGER', 'ADMIN')
  async delete(@Param('id') id: string) {
    const exists = await this.prisma.yacht.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Yacht not found');
    await this.prisma.yacht.delete({ where: { id } });
    return { success: true };
  }
}
