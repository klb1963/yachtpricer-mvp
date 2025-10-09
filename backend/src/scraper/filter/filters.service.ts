// backend/src/scraper/filter/filters.service.ts

// FiltersService — это модуль, который:
// 	1.	Загружает конфигурацию фильтров (CompetitorFilters)
// → выбирает приоритетно filterId, потом USER, потом ORG, потом дефолты.
// → данные кешируются в this.cfg.
// 	2.	Содержит бизнес-логику отбора кандидатов (passes())
// → проверяет длину, год, каюты, heads, страну, категорию, билдера, локацию;
// → логирует KEEP / DROP c jobId;
// → возвращает { ok, reason }.
// 	3.	Нормализует единицы измерения и строки
// → футы ↔ метры, нормализация trim().toLowerCase().
// 	4.	Позволяет найти Nausys-IDs по подстроке в алиасах
// (resolveNausysLocationIdsByAliasSubstring) — это важный мост к NauSYS API.

import { Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type FilterConfig = {
  // длина (ft)
  lenMinus: number;
  lenPlus: number;
  // год
  yearMinus: number;
  yearPlus: number;
  // каюты
  cabinsMinus: number;
  cabinsPlus: number;
  // санузлы (минимум у кандидата относительно таргета)
  headsMin: number;
  // запас на будущее (пока не используем в passes)
  peopleMinus: number;
  peoplePlus: number;
  /** Разрешённые ISO-2 коды стран из сохранённого Competitor Filter */
  allowedCountryCodes: string[];
  /** Разрешённые категории яхт (ID) */
  allowedCategoryIds: number[];
  /** Разрешённые производители/бренды (ID) */
  allowedBuilderIds: number[];
};

export type LoadArgs = {
  orgId: string | null;
  userId: string | null;
  /** Опционально: явно выбранный сохранённый Competitor Filter */
  filterId?: string | null;
};

type CandidateLite = {
  lengthFt: number | null;
  cabins: number | null;
  heads: number | null;
  year: number | null;
  type?: string | null;
  marina?: string | null;
  /** ISO-2 код страны кандидата (например, "GR" / "HR") */
  countryCode?: string | null;
  /** числовой ID категории кандидата */
  categoryId?: number | null;
  /** числовой ID производителя кандидата */
  builderId?: number | null;
};

type DtoLike = { location?: string | null | undefined };

type PassCtx = {
  dto?: DtoLike;
  targetLenFt?: number | null;
  targetCabins?: number | null;
  targetHeads?: number | null;
  targetYear?: number | null;
  targetType?: string | null;
  targetLocation?: string | null;
  jobId?: string | null;
};

const DEFAULTS: FilterConfig = {
  lenMinus: 3,
  lenPlus: 3,
  yearMinus: 2,
  yearPlus: 2,
  peopleMinus: 1,
  peoplePlus: 1,
  cabinsMinus: 1,
  cabinsPlus: 1,
  headsMin: 0,
  allowedCountryCodes: [],
  allowedCategoryIds: [],
  allowedBuilderIds: [],
};

@Injectable()
export class FiltersService {
  private readonly log = new Logger('FiltersService');

  // текущая конфигурация (кешируется после loadConfig)
  private cfg: FilterConfig = { ...DEFAULTS };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Загружаем фильтры:
   * - если пришёл filterId и он принадлежит orgId — используем его,
   * - иначе берём USER-скоуп (последний updatedAt),
   * - иначе ORG-скоуп,
   * - иначе — дефолты из DEFAULTS.
   */
  async loadConfig(
    _prisma: PrismaService | PrismaClient,
    { orgId, userId, filterId }: LoadArgs,
  ): Promise<void> {
    if (!orgId) {
      this.cfg = { ...DEFAULTS };
      return;
    }

    // 1) Явно выбранный фильтр
    const byId = filterId
      ? await this.prisma.competitorFilters.findUnique({
          where: { id: filterId },
          include: {
            countries: { select: { code2: true } },
            categories: { select: { id: true } },
            builders: { select: { id: true } },
          },
        })
      : null;

    if (byId) {
      if (byId.orgId !== orgId) {
        this.log.warn(
          `loadConfig(): filterId=${filterId} does not belong to org=${orgId}, ignoring`,
        );
      } else {
        this.cfg = {
          lenMinus: byId.lenFtMinus,
          lenPlus: byId.lenFtPlus,
          yearMinus: byId.yearMinus,
          yearPlus: byId.yearPlus,
          peopleMinus: byId.peopleMinus,
          peoplePlus: byId.peoplePlus,
          cabinsMinus: byId.cabinsMinus,
          cabinsPlus: byId.cabinsPlus,
          headsMin: byId.headsMin,
          allowedCountryCodes: (byId.countries ?? [])
            .map((c) => (c.code2 ?? '').toUpperCase())
            .filter((s): s is string => s.length > 0),
          allowedCategoryIds: (byId.categories ?? []).map((c) => c.id),
          allowedBuilderIds: (byId.builders ?? []).map((b) => b.id),
        };
        this.log.log(
          `loadConfig(): applied explicit filterId=${filterId} (org=${orgId}) with countries=[${this.cfg.allowedCountryCodes.join(', ')}]`,
        );
        return;
      }
    }

    // 2) Иначе — USER → ORG → DEFAULTS
    const byUser = userId
      ? await this.prisma.competitorFilters.findFirst({
          where: { orgId, scope: 'USER', userId },
          orderBy: { updatedAt: 'desc' },
          include: {
            countries: { select: { code2: true } },
            categories: { select: { id: true } },
            builders: { select: { id: true } },
          },
        })
      : null;

    const row =
      byUser ??
      (await this.prisma.competitorFilters.findFirst({
        where: { orgId, scope: 'ORG' },
        orderBy: { updatedAt: 'desc' },
        include: {
          countries: { select: { code2: true } },
          categories: { select: { id: true } },
          builders: { select: { id: true } },
        },
      }));

    if (!row) {
      this.cfg = { ...DEFAULTS };
      return;
    }

    this.cfg = {
      lenMinus: row.lenFtMinus,
      lenPlus: row.lenFtPlus,
      yearMinus: row.yearMinus,
      yearPlus: row.yearPlus,
      peopleMinus: row.peopleMinus,
      peoplePlus: row.peoplePlus,
      cabinsMinus: row.cabinsMinus,
      cabinsPlus: row.cabinsPlus,
      headsMin: row.headsMin,
      allowedCountryCodes: (row.countries ?? [])
        .map((c) => (c.code2 ?? '').toUpperCase())
        .filter((s): s is string => s.length > 0),
      allowedCategoryIds: (row.categories ?? []).map((c) => c.id),
      allowedBuilderIds: (row.builders ?? []).map((b) => b.id),
    };
  }

  /** Отдаём текущий конфиг (иногда удобно для логов/отладки). */
  getConfig(): FilterConfig {
    return this.cfg;
  }

  /** Метры → футы (<=30 считаем метрами, иначе уже футы). */
  normalizeLengthToFeet(value: unknown): number | null {
    const M_TO_FT = 3.28084;
    const n =
      typeof value === 'number'
        ? value
        : value instanceof Prisma.Decimal
          ? value.toNumber()
          : Number(value);

    if (!Number.isFinite(n) || n <= 0) return null;
    return n <= 30 ? n * M_TO_FT : n;
  }

  /** Нормализация строки. */
  private norm(s?: string | null) {
    return s?.trim().toLowerCase() ?? null;
  }

  /** Эвристика по стране (оставляем на будущее; сейчас страна берётся из allowedCountryCodes). */
  private guessCountry(place?: string | null): 'GR' | 'HR' | null {
    const map: Record<string, 'GR' | 'HR'> = {
      // Greece
      athens: 'GR',
      lefkada: 'GR',
      corfu: 'GR',
      kerkira: 'GR',
      lavrio: 'GR',
      alimos: 'GR',
      // Croatia
      split: 'HR',
      trogir: 'HR',
      dubrovnik: 'HR',
      kastela: 'HR',
      kaštela: 'HR',
      zadar: 'HR',
      pula: 'HR',
    };
    const s = this.norm(place);
    if (!s) return null;
    for (const k of Object.keys(map)) {
      if (s.includes(k)) return map[k];
    }
    return null;
  }

  /**
   * Главный фильтр кандидата.
   * Использует КЕШИРОВАННУЮ конфигурацию (this.cfg), которую загрузили через loadConfig().
   * Возвращает { ok, reason? } — причина для логов/UI.
   */
  passes(
    candidate: CandidateLite,
    ctx: PassCtx,
  ): { ok: boolean; reason?: string } {
    const reasons: string[] = [];

    // Тип корпуса — если у таргета задан, требуем точного совпадения
    if (ctx.targetType) {
      const ct = this.norm(candidate.type);
      const tt = this.norm(ctx.targetType);
      if (!ct || ct !== tt)
        reasons.push(`type mismatch: ${ct ?? '∅'} vs ${tt}`);
    }

    // Длина: окно [target - lenMinus; target + lenPlus]
    if (typeof ctx.targetLenFt === 'number' && candidate.lengthFt != null) {
      const min = ctx.targetLenFt - this.cfg.lenMinus;
      const max = ctx.targetLenFt + this.cfg.lenPlus;
      if (candidate.lengthFt < min || candidate.lengthFt > max) {
        reasons.push(
          `length ${candidate.lengthFt}ft ∉ [${min.toFixed(1)}; ${max.toFixed(
            1,
          )}]`,
        );
      }
    }

    // Каюты: допускаем ± (cabinsMinus / cabinsPlus)
    if (typeof ctx.targetCabins === 'number' && candidate.cabins != null) {
      const minCab = ctx.targetCabins - this.cfg.cabinsMinus;
      const maxCab = ctx.targetCabins + this.cfg.cabinsPlus;
      if (candidate.cabins < minCab || candidate.cabins > maxCab) {
        reasons.push(`cabins ${candidate.cabins} ∉ [${minCab}; ${maxCab}]`);
      }
    }

    // Heads: кандидат не меньше таргета, если headsMin > 0
    if (
      this.cfg.headsMin > 0 &&
      typeof ctx.targetHeads === 'number' &&
      candidate.heads != null &&
      candidate.heads < ctx.targetHeads
    ) {
      reasons.push(`heads ${candidate.heads} < target ${ctx.targetHeads}`);
    }

    // Год: в окне [target - yearMinus; target + yearPlus]
    if (typeof ctx.targetYear === 'number' && candidate.year != null) {
      const minY = ctx.targetYear - this.cfg.yearMinus;
      const maxY = ctx.targetYear + this.cfg.yearPlus;
      if (candidate.year < minY || candidate.year > maxY) {
        reasons.push(`year ${candidate.year} ∉ [${minY}; ${maxY}]`);
      }
    }

    // === Страна (унифицированная проверка)
    // если в конфиге заданы разрешённые ISO-2 коды — кандидат обязан иметь код из списка
    const allowed = this.cfg.allowedCountryCodes ?? [];
    if (allowed.length > 0) {
      const cand = (candidate.countryCode ?? '').toUpperCase() || null;
      if (!cand || !allowed.includes(cand)) {
        reasons.push(
          `country mismatch: ${cand ?? '∅'} ∉ [${allowed.join(', ')}]`,
        );
      }
    }

    // Категория: если в конфиге заданы разрешённые категории (типы) яхт — проверяем
    const allowedCats = this.cfg.allowedCategoryIds ?? [];
    if (allowedCats.length > 0) {
      const cid = candidate.categoryId ?? null;
      if (cid == null || !allowedCats.includes(cid)) {
        reasons.push(
          `category mismatch: ${cid ?? '∅'} ∉ [${allowedCats.join(', ')}]`,
        );
      }
    }

    // Производитель: если в конфиге заданы разрешённые builder’ы — проверяем
    const allowedBuilders = this.cfg.allowedBuilderIds ?? [];
    if (allowedBuilders.length > 0) {
      const bid = candidate.builderId ?? null;
      if (bid == null || !allowedBuilders.includes(bid)) {
        reasons.push(
          `builder mismatch: ${bid ?? '∅'} ∉ [${allowedBuilders.join(', ')}]`,
        );
      }
    }

    // Локация (пока упрощённо): если в dto задано location — проверим подстроку
    if (ctx.dto?.location && candidate.marina) {
      const a = this.norm(candidate.marina);
      const b = this.norm(ctx.dto.location);
      if (a && b && !a.includes(b)) {
        reasons.push(`location "${candidate.marina}" !~ "${ctx.dto.location}"`);
      }
    }

    if (reasons.length) {
      this.log.log(`[${ctx.jobId ?? '-'}] DROP: ${reasons.join(' | ')}`);
      return { ok: false, reason: reasons.join(' | ') };
    }
    this.log.log(`[${ctx.jobId ?? '-'}] KEEP`);
    return { ok: true };
  }

  /**
   * Возвращает массив NauSYS locationIds для строки локации (по алиасам → Location → externalId).
   * Используем, чтобы ограничивать NauSYS-поиск по месту базирования target лодки.
   */
  async resolveNausysLocationIdsByAliasSubstring(
    sub: string,
  ): Promise<number[]> {
    const aliases = await this.prisma.locationAlias.findMany({
      where: { alias: { contains: sub, mode: 'insensitive' } },
      select: { locationId: true },
      take: 200,
    });
    if (!aliases.length) return [];
    const locs = await this.prisma.location.findMany({
      where: {
        id: { in: aliases.map((a) => a.locationId) },
        source: 'NAUSYS',
      },
      select: { externalId: true },
    });
    return locs
      .map((l) => Number(l.externalId))
      .filter((n): n is number => Number.isFinite(n));
  }
}
