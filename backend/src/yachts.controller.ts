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
import { Roles } from './auth/roles.decorator';
import { PrismaService } from './prisma/prisma.service';
import { getEffectiveBasePriceForWeek } from './pricing-decisions/effective-base-price.helper';

// Локальный тип для YachtType, чтобы не тянуть enum из @prisma/client
type YachtType = 'monohull' | 'catamaran' | 'trimaran' | 'compromis';

// DTO для элементов истории цены
interface PriceHistoryItemDto {
  date: string; // PriceHistory.date
  weekStart: string; // WeekSlot.startDate
  price: number;
  discountPct: number;
  source: string | null;
  note: string | null;
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
//   undefined → поле не трогаем
//   null      → явно сбрасываем в null
//   number    → сохраняем число
const toNullableNum = (v: unknown): number | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function safeStr(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

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
      sort?:
        | 'createdDesc'
        | 'priceAsc'
        | 'priceDesc'
        | 'yearAsc'
        | 'yearDesc'
        | 'nameAsc'
        | 'nameDesc'
        | 'lengthAsc'
        | 'lengthDesc';
      page?: string;
      pageSize?: string;
      // неделя, для которой хотим показывать base price
      weekStart?: string;
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

    // 🔹 Пытаемся распарсить weekStart из query, как в byId()
    let weekStartDate: Date | null = null;
    if (query.weekStart) {
      const d = new Date(query.weekStart);
      if (!Number.isNaN(d.getTime())) {
        weekStartDate = d;
      }
    }

    // where + orderBy без жёстких Prisma-типов
    const andClauses: Array<Record<string, any> | undefined> = [
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

    const where: Record<string, any> = {
      AND: andClauses.filter(Boolean),
    };

    let orderBy: any = { createdAt: 'desc' };

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
      case 'nameAsc':
        orderBy = [{ name: 'asc' }, { createdAt: 'desc' }];
        break;
      case 'nameDesc':
        orderBy = [{ name: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'lengthAsc':
        orderBy = [{ length: 'asc' }, { createdAt: 'desc' }];
        break;
      case 'lengthDesc':
        orderBy = [{ length: 'desc' }, { createdAt: 'desc' }];
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

    // 🔹 «Эффективная» базовая цена по последнему APPROVED-решению
    //    на/до выбранной недели
    let effectiveByYacht: Record<
      string,
      { price: any | null; fromWeekStart?: Date | null }
    > = {};

    if (items.length > 0 && weekStartDate) {
      const entries = await Promise.all(
        items.map(async (y: any) => {
          const eff = await getEffectiveBasePriceForWeek(this.prisma, {
            yachtId: y.id,
            weekStart: weekStartDate!,
          });
          return [y.id, eff] as const;
        }),
      );

      effectiveByYacht = Object.fromEntries(entries);
    }

    const mapped = items.map((y:any) => {
      let currentBasePrice: number | null = null;
      let selectedWeekStart: string | null = null;

      if (weekStartDate) {
        // если неделя запрошена — стараемся отдать эффективную цену
        const eff = effectiveByYacht[y.id];
        if (eff && eff.price != null) {
          currentBasePrice = Number(eff.price as any);
          selectedWeekStart = weekStartDate.toISOString();
        } else {
          // нет решений — возвращаем исходную basePrice яхты
          currentBasePrice =
            typeof y.basePrice === 'string'
              ? Number(y.basePrice as any)
              : y.basePrice != null
              ? Number(y.basePrice as any)
              : null;
          selectedWeekStart = weekStartDate.toISOString();
        }
      }

      return {
        ...y,
        countryCode: y.country?.code2 ?? null,
        countryName: y.country?.name ?? null,
        currentBasePrice,
        selectedWeekStart,
      };
    });

    return { items: mapped, total, page, pageSize };
  }

  // -------- by id --------
  @Get(':id')
  async byId(
    @Param('id') id: string,
    @Query('weekStart') weekStart?: string,
  ): Promise<any> {
    const y = await this.prisma.yacht.findUnique({
      where: { id },
      include: {
        country: true,
        category: true,
        builder: true,
      },
    });
    if (!y) throw new NotFoundException('Yacht not found');

    // --- Ответственный менеджер (если назначен) ---
    const link = await this.prisma.managerYacht.findFirst({
      where: { yachtId: id },
      include: {
        manager: true,
      },
    });

    const responsibleManagerId = link?.managerId ?? null;
    const responsibleManagerName =
      (link?.manager?.name && link.manager.name.trim()) ||
      link?.manager?.email ||
      null;

    // --- История за последний год (можно потом параметризовать) ---
    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setFullYear(now.getFullYear() - 1);

    // 🔹 Пытаемся распарсить weekStart из query
    let weekStartDate: Date | null = null;
    if (weekStart) {
      const d = new Date(weekStart);
      if (!Number.isNaN(d.getTime())) {
        weekStartDate = d;
      }
    }

    // 🔹 Фильтр для истории: по яхте, за последний год
    // и, если задана неделя, только weekSlots с startDate <= weekStart
    const historyWhere: any = {
      weekSlot: {
        yachtId: id,
        ...(weekStartDate ? { startDate: { lte: weekStartDate } } : {}),
      },
      date: {
        gte: yearAgo,
      },
    };

    const history = await this.prisma.priceHistory.findMany({
      where: historyWhere,
      orderBy: {
        date: 'asc', // для таблицы сверху-вниз во времени
      },
      include: {
        weekSlot: true,
      },
    });

    const last = history.length > 0 ? history[history.length - 1] : null;

    // 🔹 Текущие "фактические" цена и скидка на выбранную неделю (или последнюю)
    const currentPrice =
      last?.price != null ? Number(last.price as any) : null;
    const currentDiscountPct =
      last?.discount != null ? Number(last.discount as any) : null;
    const currentPriceUpdatedAt = last ? last.date.toISOString() : null;

    // 🔹 Базовая цена и валюта на эту же неделю
    let currentBasePrice: number | null = null;
    let currency: string | null = null;

    if (last?.weekSlot) {
      const slot = last.weekSlot;

      if (slot.basePrice != null) {
        currentBasePrice = Number(slot.basePrice as any);
      } else if (last.price != null) {
        // fallback: если ещё не заполняем basePrice, используем фактическую цену
        currentBasePrice = Number(last.price as any);
      }

      // аккуратно читаем валюту, чтобы не ловить no-unsafe-assignment
      if (typeof slot.currency === 'string') {
        currency = safeStr(slot.currency);
      } else {
        currency = null;
      }
    }

    // 🔹 Какую неделю считаем "выбранной" для этой карточки
    let selectedWeekStart: string | null = null;
    if (weekStartDate) {
      selectedWeekStart = weekStartDate.toISOString();
    } else if (last?.weekSlot?.startDate) {
      selectedWeekStart = last.weekSlot.startDate.toISOString();
    }

    const priceHistory: PriceHistoryItemDto[] = history.map((h:any) => ({
      date: h.date.toISOString(),
      weekStart: h.weekSlot.startDate.toISOString(),
      price: Number(h.price as any),
      discountPct: Number(h.discount as any),
      source: (h.source as any as string) ?? null,
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
      responsibleManagerId,
      responsibleManagerName,
      currentBasePrice,
      currency,
      selectedWeekStart,
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

  private isJsonInputValue(v: unknown): v is any {
    try {
      JSON.stringify(v);
      return true;
    } catch {
      return false;
    }
  }

  private toJsonValueEnsure(v: unknown): any {
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

  private toJsonValueOptional(v: unknown): any {
    if (v === undefined) return undefined;
    return this.toJsonValueEnsure(v);
  }

  // ===== create =====
  @Post()
  @Roles('MANAGER', 'FLEET_MANAGER', 'ADMIN')
  async create(@Body() body: Record<string, unknown>) {
    // --- helper for validation errors (i18n handled on frontend) ---
    const throwValidation = (field: string, messageKey: string): never => {
      throw new BadRequestException({
        type: 'VALIDATION_ERROR',
        field,
        messageKey, // пример: 'yacht:errors.nameRequired'
      });
    };

    // --- basic validation, messageKey -> public/locales/*/yacht.json ---
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      throwValidation('name', 'yacht:errors.nameRequired');
    }

    if (!body.fleet || typeof body.fleet !== 'string' || !body.fleet.trim()) {
      throwValidation('fleet', 'yacht:errors.fleetRequired');
    }

    if (
      !body.charterCompany ||
      typeof body.charterCompany !== 'string' ||
      !body.charterCompany.trim()
    ) {
      throwValidation('charterCompany', 'yacht:errors.charterCompanyRequired');
    }

    if (!body.countryId) {
      throwValidation('countryId', 'yacht:errors.countryRequired');
    }

    if (!body.categoryId) {
      throwValidation('categoryId', 'yacht:errors.categoryRequired');
    }

    if (!body.builtYear) {
      throwValidation('builtYear', 'yacht:errors.builtYearRequired');
    }

    if (!body.cabins) {
      throwValidation('cabins', 'yacht:errors.cabinsRequired');
    }

    if (!body.heads) {
      throwValidation('heads', 'yacht:errors.headsRequired');
    }

    const baseData = {
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
    // 🔹 NauSYS external ID
    const nausysId = toNullableStr(body['nausysId']);

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

    const data: any = {
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
      ...(nausysId !== undefined ? { nausysId } : {}),
    };

    return this.prisma.yacht.create({ data });
  }

  // ===== update =====
  @Patch(':id')
  @Roles('MANAGER', 'FLEET_MANAGER', 'ADMIN')
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

    const data: any = {
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

    // 🔹 nausysId: string | null | undefined
    const nausysId = toNullableStr(body['nausysId']);
    if (nausysId !== undefined) {
      data.nausysId = nausysId;
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
      let countryUpdate: any;
      if (v === null) {
        countryUpdate = { disconnect: true };
      } else if (typeof v === 'string' && v) {
        countryUpdate = { connect: { id: v } };
      }
      if (countryUpdate) data.country = countryUpdate;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'categoryId')) {
      const v = toNullableInt(body['categoryId']);
      let categoryUpdate: any;
      if (v === null) {
        categoryUpdate = { disconnect: true };
      } else if (typeof v === 'number') {
        categoryUpdate = { connect: { id: v } };
      }
      if (categoryUpdate) data.category = categoryUpdate;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'builderId')) {
      const v = toNullableInt(body['builderId']);
      let builderUpdate: any;
      if (v === null) {
        builderUpdate = { disconnect: true };
      } else if (typeof v === 'number') {
        builderUpdate = { connect: { id: v } };
      }
      if (builderUpdate) data.builder = builderUpdate;
    }

    (Object.keys(data) as Array<keyof typeof data>).forEach((k) => {
      if (data[k] === undefined) delete data[k];
    });

    // --- Обновление яхты и ответственного менеджера в одной транзакции ---
    const responsibleManagerId = this.optStr(body, 'responsibleManagerId');

    return this.prisma.$transaction(async (tx:any) => {
      // 1. Обновляем основные поля яхты
      const updatedYacht = await tx.yacht.update({
        where: { id },
        data,
        include: {
          country: { select: { id: true, code2: true, name: true } },
          category: { select: { id: true, nameEn: true, nameRu: true } },
          builder: { select: { id: true, name: true } },
        },
      });

      // 2. Обновляем связь ManagerYacht
      //    Удаляем старую и ставим новую, если передан responsibleManagerId
      await tx.managerYacht.deleteMany({ where: { yachtId: id } });

      if (responsibleManagerId) {
        await tx.managerYacht.create({
          data: {
            yachtId: id,
            managerId: responsibleManagerId,
          },
        });
      }

      return updatedYacht;
    });
  }

  // ===== delete =====
  @Delete(':id')
  @Roles('MANAGER', 'FLEET_MANAGER', 'ADMIN')
  async delete(@Param('id') id: string) {
    const exists = await this.prisma.yacht.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Yacht not found');
    await this.prisma.yacht.delete({ where: { id } });
    return { success: true };
  }
}