// backend/src/pricing/pricing.repo.ts
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  DecisionStatus,
  Yacht,
  PricingDecision,
  CompetitorSnapshot,
  PriceAuditLog,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Унифицированный тип решения c подгруженной лодкой
 * (ровно тот shape, который мы действительно используем в сервисе).
 */
export type DecisionWithYacht = PricingDecision & {
  yacht: {
    id: string;
    basePrice: Prisma.Decimal | null;
    maxDiscountPct: Prisma.Decimal | null;
  };
};

/**
 * Облегчённый тип для WeekSlot, который нужен только для списка строк:
 * берём лишь поля, реально используемые фронтом.
 *
 * В БД priceSource — enum PriceSource. Чтобы не ловить проблемы
 * с типами клиента Prisma при генерации, помечаем здесь как string|null.
 */
export type WeekSlotLight = {
  yachtId: string;
  currentPrice: Prisma.Decimal;
  currentDiscount: Prisma.Decimal;
  priceSource: string | null;
  priceFetchedAt: Date | null;
};

@Injectable()
export class PricingRepo {
  constructor(private prisma: PrismaService) {}

  /**
   * Полный список яхт (используем для построения таблицы за неделю).
   * Важно: выдаём без select — сервису нужны и Decimal-поля как есть.
   */
  async listYachts(): Promise<Yacht[]> {
    return this.prisma.yacht.findMany({ orderBy: { name: 'asc' } });
  }

  /**
   * Снимки конкурентов для недели.
   */
  async listSnapshots(weekStart: Date): Promise<CompetitorSnapshot[]> {
    return this.prisma.competitorSnapshot.findMany({
      where: { weekStart },
      orderBy: { collectedAt: 'desc' },
    });
  }

  /**
   * Решения (draft/submitted/…) на выбранную неделю.
   */
  async listDecisions(weekStart: Date): Promise<PricingDecision[]> {
    return this.prisma.pricingDecision.findMany({
      where: { weekStart },
    });
  }

  /**
   * Слоты недели по списку яхт.
   * Возвращаем ровно те поля, которые нужны для отображения «Actual price».
   */
  async listWeekSlots(
    weekStart: Date,
    yachtIds: string[],
  ): Promise<WeekSlotLight[]> {
    return this.prisma.weekSlot.findMany({
      where: { startDate: weekStart, yachtId: { in: yachtIds } },
      select: {
        yachtId: true,
        currentPrice: true,
        currentDiscount: true,
        priceSource: true, // enum в БД, здесь достаточно string|null
        priceFetchedAt: true,
      },
    });
  }

  /**
   * Аудит-логи по решениям, отсортированные по убыванию даты.
   * Сервис забирает «самый свежий на решение» сам.
   */
  async listLastAudits(decisionIds: string[]): Promise<PriceAuditLog[]> {
    return this.prisma.priceAuditLog.findMany({
      where: { decisionId: { in: decisionIds } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Найти решение (если есть) вместе с нужными полями яхты.
   */
  async getDecisionWithYacht(
    yachtId: string,
    weekStart: Date,
  ): Promise<DecisionWithYacht | null> {
    return this.prisma.pricingDecision.findUnique({
      where: { yachtId_weekStart: { yachtId, weekStart } },
      include: {
        yacht: { select: { id: true, basePrice: true, maxDiscountPct: true } },
      },
    }) as Promise<DecisionWithYacht | null>;
  }

  /**
   * Создать черновик решения на неделю для указанной яхты
   * (если его ещё не было), сразу с подгруженной яхтой.
   */
  async createDraftForYacht(
    yachtId: string,
    weekStart: Date,
  ): Promise<DecisionWithYacht> {
    const yacht = await this.prisma.yacht.findUniqueOrThrow({
      where: { id: yachtId },
      select: { id: true, basePrice: true },
    });

    return this.prisma.pricingDecision.create({
      data: {
        yachtId,
        weekStart,
        basePrice: yacht.basePrice ?? new Prisma.Decimal(0),
        status: DecisionStatus.DRAFT,
      },
      include: {
        yacht: {
          select: { id: true, basePrice: true, maxDiscountPct: true },
        },
      },
    }) as Promise<DecisionWithYacht>;
  }

  /**
   * Точечное обновление пары полей discountPct/finalPrice
   * (используется при SUBMIT).
   */
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

  /**
   * Обновить статус решения и (если APPROVED) — approvedAt.
   * Возвращаем решение с полной лодкой (на случай дальнейших шагов).
   */
  async updateStatus(
    yachtId: string,
    weekStart: Date,
    status: DecisionStatus,
  ): Promise<PricingDecision & { yacht: Yacht | null }> {
    return this.prisma.pricingDecision.update({
      where: { yachtId_weekStart: { yachtId, weekStart } },
      data: {
        status,
        approvedAt: status === DecisionStatus.APPROVED ? new Date() : null,
      },
      include: { yacht: true },
    });
  }

  /**
   * Создать запись аудита для решения.
   */
  async createAudit(
    decisionId: string,
    data: Omit<Prisma.PriceAuditLogCreateInput, 'decision'>,
  ): Promise<PriceAuditLog> {
    return this.prisma.priceAuditLog.create({
      data: { ...data, decisionId },
    });
  }

  /**
   * Унифицированный метод запуска кода в транзакции.
   * Важно использовать корректный тип клиента: Prisma.TransactionClient.
   */
  tx<T>(cb: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(cb);
  }
}
