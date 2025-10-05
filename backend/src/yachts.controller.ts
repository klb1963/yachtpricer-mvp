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

/** Хелперы парсинга */
const toInt = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isInteger(n) ? n : undefined;
};

/** nullable helpers для связей */
const toNullableStr = (v: unknown): string | null | undefined => {
  if (v === undefined) return undefined; // не трогаем поле
  if (v === null) return null; // явный сброс (disconnect)
  if (typeof v === 'string') {
    const s = v.trim();
    return s === '' ? null : s; // '' -> null
  }
  // Любые не-строки игнорируем, чтобы не получить "[object Object]"
  return undefined;
};

const toNullableInt = (v: unknown): number | null | undefined => {
  if (v === undefined) return undefined; // не трогать
  if (v === null || v === '') return null; // disconnect
  const n = Number(v);
  return Number.isInteger(n) ? n : null; // connect или disconnect
};

const toNum = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
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
      this.prisma.yacht.findMany({ where, orderBy, skip, take }),
    ]);

    return { items, total, page, pageSize };
  }

  // -------- by id --------
  @Get(':id')
  async byId(@Param('id') id: string) {
    const y = await this.prisma.yacht.findUnique({
      where: { id },
      include: {
        country: { select: { id: true, code2: true, name: true } },
        category: { select: { id: true, nameEn: true, nameRu: true } },
        builder: { select: { id: true, name: true } },
      },
    });
    if (!y) throw new NotFoundException('Yacht not found');
    return y;
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
        return v; // строка остаётся строкой
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
    const baseData: Omit<
      Prisma.YachtCreateInput,
      'currentExtraServices' | 'owner'
    > = {
      name: this.reqStr(body, 'name'),
      manufacturer: this.reqStr(body, 'manufacturer'),
      model: this.reqStr(body, 'model'),
      type: this.reqStr(body, 'type') as YachtType,
      location: this.reqStr(body, 'location'),
      fleet: this.reqStr(body, 'fleet'),
      charterCompany: this.reqStr(body, 'charterCompany'),
      length: this.reqNum(body, 'length'),
      builtYear: this.reqNum(body, 'builtYear'),
      cabins: this.reqNum(body, 'cabins'),
      heads: this.reqNum(body, 'heads'),
      basePrice: this.reqStr(body, 'basePrice'),
      ownerName: this.optStr(body, 'ownerName'),
    };

    const services = this.toJsonValueEnsure(body['currentExtraServices']);
    const ownerId = this.optStr(body, 'ownerId');

    // значения связей (один раз вычисляем)
    const countryId = toNullableStr(body['countryId']); // string | null | undefined
    const categoryId = toNullableInt(body['categoryId']); // number | null | undefined
    const builderId = toNullableInt(body['builderId']); // number | null | undefined

    const data: Prisma.YachtCreateInput = {
      ...baseData,
      currentExtraServices: services,
      ...(ownerId ? { owner: { connect: { id: ownerId } } } : {}),
      // 👇 новые связи (при создании null/undefined просто пропускаем)
      ...(countryId ? { country: { connect: { id: countryId } } } : {}),
      ...(typeof categoryId === 'number'
        ? { category: { connect: { id: categoryId } } }
        : {}),
      ...(typeof builderId === 'number'
        ? { builder: { connect: { id: builderId } } }
        : {}),
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

    if (Object.prototype.hasOwnProperty.call(body, 'currentExtraServices')) {
      const val = this.toJsonValueOptional(body['currentExtraServices']);
      if (val !== undefined) data.currentExtraServices = val;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'ownerId')) {
      const idStr = asStr('ownerId');
      if (idStr) data.owner = { connect: { id: idStr } };
    }

    // ====== связи: country / category / builder ======
    // countryId: string UUID | null | undefined
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

    // categoryId: number | null | undefined
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

    // builderId: number | null | undefined
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

    // зачистка undefined
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
