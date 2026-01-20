// backend/src/pricing/pricing.repo.ts

import { Injectable } from '@nestjs/common';
import {
  Prisma,
  DecisionStatus,
  PricingDecision,
  CompetitorSnapshot,
  ScrapeSource,
  PriceAuditLog,
  PriceListNode,
  PriceSource,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { WeekSlotMini } from './pricing-mappers';

/** Решение с нужными полями лодки (строго как в include/select). */
export type DecisionWithYacht = Prisma.PricingDecisionGetPayload<{
  include: {
    yacht: { select: { id: true; basePrice: true; maxDiscountPct: true } };
  };
}>;

/** Яхты для rows(): описываем через Prisma payload, чтобы типы совпадали с select. */
export type YachtForRows = Prisma.YachtGetPayload<{
  select: {
    id: true;
    name: true;
    basePrice: true;
    location: true;
    builtYear: true;
    length: true;
    type: true;
    orgId: true;
    maxDiscountPct: true;
  };
}>;

@Injectable()
export class PricingRepo {
  constructor(private prisma: PrismaService) {}

  /** Полный список яхт для таблички. Возвращаем только нужные поля. */
  async listYachts(): Promise<YachtForRows[]> {
    return this.prisma.yacht.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        basePrice: true,
        location: true,
        builtYear: true,
        length: true,
        type: true,
        orgId: true,
        maxDiscountPct: true,
      },
    });
  }

  /**
   * Снимки конкурентов для недели.
   * Если source передан — фильтруем по конкретному источнику (INNERDB / NAUSYS / BOATAROUND).
   * Если нет — ведём себя как раньше и возвращаем все снапшоты за неделю.
   */
  async listSnapshots(
    weekStart: Date,
    source?: ScrapeSource,
  ): Promise<CompetitorSnapshot[]> {
    return this.prisma.competitorSnapshot.findMany({
      where: {
        weekStart,
        ...(source ? { source } : {}),
      },
      orderBy: { collectedAt: 'desc' },
    });
  }

  /** Решения на выбранную неделю. */
  async listDecisions(weekStart: Date): Promise<PricingDecision[]> {
    return this.prisma.pricingDecision.findMany({
      where: { weekStart },
    });
  }

  /**
   * Слоты недели по списку яхт. Возвращаем ровно те поля, что нужны для «Actual price».
   */
  async listWeekSlots(
    weekStart: Date,
    yachtIds: string[],
  ): Promise<WeekSlotMini[]> {
    return this.prisma.weekSlot.findMany({
      where: { startDate: weekStart, yachtId: { in: yachtIds } },
      select: {
        yachtId: true,
        currentPrice: true,
        currentDiscount: true,
        priceSource: true,
        priceFetchedAt: true,
      },
    });
  }

  /** Аудит-логи по решениям, отсортированные по убыванию даты. */
  async listLastAudits(decisionIds: string[]): Promise<PriceAuditLog[]> {
    return this.prisma.priceAuditLog.findMany({
      where: { decisionId: { in: decisionIds } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Найти решение (если есть) вместе с нужными полями яхты. */
  async getDecisionWithYacht(
    yachtId: string,
    weekStart: Date,
  ): Promise<DecisionWithYacht | null> {
    return this.prisma.pricingDecision.findUnique({
      where: { yachtId_weekStart: { yachtId, weekStart } },
      include: {
        yacht: { select: { id: true, basePrice: true, maxDiscountPct: true } },
      },
    });
  }

  /**
   * Создать черновик решения на неделю для указанной яхты (если его ещё не было),
   * сразу с подгруженной яхтой.
   */
  async createDraftForYacht(
    yachtId: string,
    weekStart: Date,
    basePrice: Prisma.Decimal | null,
  ): Promise<DecisionWithYacht> {
    const yacht = await this.prisma.yacht.findUniqueOrThrow({
      where: { id: yachtId },
      select: { id: true, basePrice: true },
    });

    const base = basePrice ?? yacht.basePrice ?? new Prisma.Decimal(0);

    return this.prisma.pricingDecision.create({
      data: {
        yachtId,
        weekStart,
        basePrice: base,
        status: DecisionStatus.DRAFT,
      },
      include: {
        yacht: {
          select: { id: true, basePrice: true, maxDiscountPct: true },
        },
      },
    });
  }

  /** Точечное обновление пары discountPct/finalPrice (для SUBMIT). */
  async upsertDecisionPair(
    yachtId: string,
    weekStart: Date,
    data: Partial<{
      discountPct: Prisma.Decimal | null;
      finalPrice: Prisma.Decimal | null;
    }>,
  ): Promise<PricingDecision> {
    return this.prisma.pricingDecision.update({
      where: { yachtId_weekStart: { yachtId, weekStart } },
      data,
    });
  }

  /** Обновить статус решения и (если APPROVED) — approvedAt. */
  async updateStatus(
    yachtId: string,
    weekStart: Date,
    status: DecisionStatus,
  ): Promise<Prisma.PricingDecisionGetPayload<{ include: { yacht: true } }>> {
    return this.prisma.pricingDecision.update({
      where: { yachtId_weekStart: { yachtId, weekStart } },
      data: {
        status,
        approvedAt: status === DecisionStatus.APPROVED ? new Date() : null,
      },
      include: { yacht: true },
    });
  }

  /** Создать запись аудита для решения. */
  async createAudit(
    decisionId: string,
    data: Omit<Prisma.PriceAuditLogUncheckedCreateInput, 'decisionId'>,
  ): Promise<PriceAuditLog> {
    return this.prisma.priceAuditLog.create({
      data: { ...data, decisionId },
    });
  }

  async listPriceListNodes(yachtId: string): Promise<PriceListNode[]> {
    return this.prisma.priceListNode.findMany({
      where: { yachtId },
      orderBy: { weekStart: 'asc' },
    });
  }

  async upsertPriceListNode(params: {
    yachtId: string;
    weekStart: Date;
    price: Prisma.Decimal;
    currency?: string;
    source?: PriceSource;
    note?: string | null;
    authorId?: string | null;
  }): Promise<PriceListNode> {
    const { yachtId, weekStart, price, currency, source, note, authorId } =
      params;

    return this.prisma.priceListNode.upsert({
      where: { yachtId_weekStart: { yachtId, weekStart } },
      create: {
        yachtId,
        weekStart,
        price,
        currency: currency ?? 'EUR',
        source: source ?? PriceSource.INTERNAL,
        note: note ?? null,
        authorId: authorId ?? null,
      },
      update: {
        price,
        currency: currency ?? 'EUR',
        source: source ?? PriceSource.INTERNAL,
        note: note ?? null,
        authorId: authorId ?? null,
      },
    });
  }

  async deletePriceListNode(yachtId: string, weekStart: Date): Promise<void> {
    await this.prisma.priceListNode.delete({
      where: { yachtId_weekStart: { yachtId, weekStart } },
    });
  }

  /** Унифицированный запуск кода в транзакции. */
  tx<T>(cb: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(cb);
  }
}
