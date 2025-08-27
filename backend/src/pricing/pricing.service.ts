// backend/src/pricing/pricing.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma, DecisionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingRowsQueryDto, UpsertDecisionDto, ChangeStatusDto } from './pricing.dto';

/** Суббота 00:00 UTC для заданной даты */
function weekStartUTC(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay(); // 0..6 (вск..сб)
  const diff = (day - 6 + 7) % 7; // до субботы
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  /** Табличка по флоту на неделю: базовая цена, снапшот, черновик решения и предложка mlReco */
  async rows(q: PricingRowsQueryDto) {
    const ws = weekStartUTC(new Date(q.week));

    // Лодки (минимум полей для таблицы)
    const yachts = await this.prisma.yacht.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        basePrice: true,
        location: true,
        builtYear: true,
        length: true,
        type: true,
      },
    });

    // Снимки конкурентов и текущие решения на эту неделю
    const [snaps, decisions] = await Promise.all([
      this.prisma.competitorSnapshot.findMany({
        where: { weekStart: ws },
        orderBy: { collectedAt: 'desc' },
      }),
      this.prisma.pricingDecision.findMany({
        where: { weekStart: ws },
      }),
    ]);

    const snapByYacht = new Map(snaps.map((s) => [s.yachtId, s]));
    const decByYacht = new Map(decisions.map((d) => [d.yachtId, d]));

    // Собираем финальную строку по каждой лодке
    return yachts.map((y) => {
      const s = snapByYacht.get(y.id);
      const d = decByYacht.get(y.id);

      // простая эвристика: рекомендация = top3Avg, если есть
      const mlReco = s?.top3Avg ?? null;

      // если у решения есть discountPct, пересчитаем итог (если finalPrice не задан)
      let finalPrice = d?.finalPrice ?? null;
      if (finalPrice == null && d?.discountPct != null) {
        // Decimal-арифметика
        finalPrice = y.basePrice.mul(new Prisma.Decimal(1).sub(d.discountPct.div(100)));
      }

      return {
        yachtId: y.id,
        name: y.name,
        basePrice: y.basePrice,
        snapshot: s
          ? {
              top1Price: s.top1Price,
              top3Avg: s.top3Avg,
              currency: s.currency,
              sampleSize: s.sampleSize,
              collectedAt: s.collectedAt,
            }
          : null,
        decision: d
          ? {
              discountPct: d.discountPct,
              finalPrice: d.finalPrice,
              status: d.status,
            }
          : null,
        mlReco,
        finalPrice,
      };
    });
  }

  /** Создать/обновить черновик решения на неделю для лодки */
  async upsertDecision(dto: UpsertDecisionDto) {
    const ws = weekStartUTC(new Date(dto.week));

    // текущая базовая цена лодки в Decimal
    const yacht = await this.prisma.yacht.findUnique({
      where: { id: dto.yachtId },
      select: { basePrice: true },
    });
    const basePriceDecimal = yacht?.basePrice ?? new Prisma.Decimal(0);

    // приводим входные числа к Decimal (или null)
    const discountDec =
      dto.discountPct != null ? new Prisma.Decimal(dto.discountPct) : null;
    const finalPriceDec =
      dto.finalPrice != null ? new Prisma.Decimal(dto.finalPrice) : null;

    // upsert без include (иначе TS может дать include: never)
    await this.prisma.pricingDecision.upsert({
      where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
      create: {
        yachtId: dto.yachtId,
        weekStart: ws,
        basePrice: basePriceDecimal,
        discountPct: discountDec,
        finalPrice: finalPriceDec,
        status: DecisionStatus.DRAFT,
      },
      update: {
        discountPct: discountDec,
        finalPrice: finalPriceDec,
      },
    });

    // возвращаем ту же запись уже с include
    return this.prisma.pricingDecision.findUnique({
      where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
      include: { yacht: true },
    });
  }

  /** Смена статуса решения */
  async changeStatus(dto: ChangeStatusDto) {
    const ws = weekStartUTC(new Date(dto.week));

    await this.prisma.pricingDecision.update({
      where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
      data: {
        status: dto.status,
        approvedAt: dto.status === 'APPROVED' ? new Date() : null,
      },
    });

    return this.prisma.pricingDecision.findUnique({
      where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
      include: { yacht: true },
    });
  }
}