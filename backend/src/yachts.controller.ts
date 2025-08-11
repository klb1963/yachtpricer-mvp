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
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('yachts')
export class YachtsController {
  // -------- list --------
  @Get()
  async list() {
    return prisma.yacht.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
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
