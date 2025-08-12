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
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/** Хелперы парсинга */
const toInt = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isInteger(n) ? n : undefined;
};
const toNum = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b);

@Controller('yachts')
export class YachtsController {
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
    // 1) Параметры
    const q = (query.q ?? '').trim();
    const type = (query.type ?? '').trim() || undefined;

    const minYear = toInt(query.minYear);
    const maxYear = toInt(query.maxYear);

    // basePrice у нас Decimal — Prisma принимает number | string
    const minPrice = toNum(query.minPrice);
    const maxPrice = toNum(query.maxPrice);

    const page = clamp(toInt(query.page) ?? 1, 1, 10_000);
    const pageSize = clamp(toInt(query.pageSize) ?? 20, 1, 200);
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // 2) WHERE
    const where: Prisma.YachtWhereInput = {
      AND: [
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
        type ? { type } : undefined,
        minYear !== undefined ? { builtYear: { gte: minYear } } : undefined,
        maxYear !== undefined ? { builtYear: { lte: maxYear } } : undefined,
        minPrice !== undefined
          ? { basePrice: { gte: String(minPrice) } }
          : undefined,
        maxPrice !== undefined
          ? { basePrice: { lte: String(maxPrice) } }
          : undefined,
      ].filter(Boolean) as Prisma.YachtWhereInput[],
    };

    // 3) ORDER BY
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

    // 4) total + items (одной транзакцией)
    const [total, items] = await prisma.$transaction([
      prisma.yacht.count({ where }),
      prisma.yacht.findMany({ where, orderBy, skip, take }),
    ]);

    // 5) Ответ для фронта
    return { items, total, page, pageSize };
  }

  // -------- by id --------
  @Get(':id')
  async byId(@Param('id') id: string) {
    const y = await prisma.yacht.findUnique({ where: { id } });
    if (!y) throw new NotFoundException('Yacht not found');
    return y;
  }

  // ===== helpers =====

  // аккуратная строка: объекты -> JSON
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

  // Проверка «это валидный JSON для записи?»
  private isJsonInputValue(v: unknown): v is Prisma.InputJsonValue {
    try {
      // Если JSON.stringify падает — это невалидное JSON-значение
      // (для строк, чисел, boolean, объектов и массивов — ок)
      JSON.stringify(v);
      return true;
    } catch {
      return false;
    }
  }

  // Для create: гарантированно вернуть Prisma.InputJsonValue (если пусто/невалидно → [])
  private toJsonValueEnsure(v: unknown): Prisma.InputJsonValue {
    if (v === undefined || v === null || v === '') return [];
    if (typeof v === 'string') {
      try {
        const parsed: unknown = JSON.parse(v); // <- явно типизируем как unknown
        return this.isJsonInputValue(parsed) ? parsed : [];
      } catch {
        // строка — валидный JSON‑скаляр, каст не нужен
        return v;
      }
    }
    // type guard isJsonInputValue уже сужает тип — каст не нужен
    return this.isJsonInputValue(v) ? v : [];
  }

  // Для update: если ключ не передан → undefined (не трогаем поле)
  private toJsonValueOptional(v: unknown): Prisma.InputJsonValue | undefined {
    if (v === undefined) return undefined;
    return this.toJsonValueEnsure(v);
  }

  // ===== create =====
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const baseData: Omit<
      Prisma.YachtCreateInput,
      'currentExtraServices' | 'owner'
    > = {
      name: this.reqStr(body, 'name'),
      manufacturer: this.reqStr(body, 'manufacturer'),
      model: this.reqStr(body, 'model'),
      type: this.reqStr(body, 'type'),
      location: this.reqStr(body, 'location'),
      fleet: this.reqStr(body, 'fleet'),
      charterCompany: this.reqStr(body, 'charterCompany'),

      length: this.reqNum(body, 'length'),
      builtYear: this.reqNum(body, 'builtYear'),
      cabins: this.reqNum(body, 'cabins'),
      heads: this.reqNum(body, 'heads'),

      // Decimal — строка/число
      basePrice: this.reqStr(body, 'basePrice'),
      //Owner name
      ownerName: this.optStr(body, 'ownerName'),
    };

    // currentExtraServices — обязателен в CreateInput: всегда заполняем (по умолчанию [])
    const services = this.toJsonValueEnsure(body['currentExtraServices']);

    // связь с владельцем (опционально)
    const ownerId = this.optStr(body, 'ownerId');

    const data: Prisma.YachtCreateInput = {
      ...baseData,
      currentExtraServices: services,
      ...(ownerId ? { owner: { connect: { id: ownerId } } } : {}),
    };

    return prisma.yacht.create({ data });
  }

  // ===== update =====
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const exists = await prisma.yacht.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Yacht not found');

    const get = (k: string) => body[k];

    const asStr = (k: string): string | undefined => this.optStr(body, k);

    const asNum = (k: string): number | undefined => {
      const v = get(k);
      if (v === undefined || v === null || v === '') return undefined;
      const n = Number(v as string | number);
      return Number.isFinite(n) ? n : undefined;
    };

    const data: Prisma.YachtUpdateInput = {
      name: asStr('name'),
      manufacturer: asStr('manufacturer'),
      model: asStr('model'),
      type: asStr('type'),
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

    // JSON поле — только если ключ присутствует
    if (Object.prototype.hasOwnProperty.call(body, 'currentExtraServices')) {
      const val = this.toJsonValueOptional(body['currentExtraServices']);
      if (val !== undefined) {
        data.currentExtraServices = val;
      }
    }

    // смена владельца (опционально)
    if (Object.prototype.hasOwnProperty.call(body, 'ownerId')) {
      const idStr = asStr('ownerId');
      if (idStr) data.owner = { connect: { id: idStr } };
    }

    // зачистка undefined
    (Object.keys(data) as Array<keyof Prisma.YachtUpdateInput>).forEach((k) => {
      if (data[k] === undefined) delete data[k];
    });

    return prisma.yacht.update({ where: { id }, data });
  }

  // ===== delete =====
  @Delete(':id')
  async delete(@Param('id') id: string) {
    const exists = await prisma.yacht.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Yacht not found');
    await prisma.yacht.delete({ where: { id } });
    return { success: true };
  }
}
