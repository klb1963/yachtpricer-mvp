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

@Injectable()
export class PricingRepo {
  constructor(private prisma: PrismaService) {}

  async listYachts(): Promise<Yacht[]> {
    return this.prisma.yacht.findMany({ orderBy: { name: 'asc' } });
  }

  async listSnapshots(weekStart: Date): Promise<CompetitorSnapshot[]> {
    return this.prisma.competitorSnapshot.findMany({
      where: { weekStart },
      orderBy: { collectedAt: 'desc' },
    });
  }

  async listDecisions(weekStart: Date): Promise<PricingDecision[]> {
    return this.prisma.pricingDecision.findMany({
      where: { weekStart },
    });
  }

  async listWeekSlots(
    weekStart: Date,
    yachtIds: string[],
  ): Promise<
    Array<{
      yachtId: string;
      currentPrice: Prisma.Decimal;
      currentDiscount: Prisma.Decimal;
      priceSource: string | null;
      priceFetchedAt: Date | null;
    }>
  > {
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

  async listLastAudits(decisionIds: string[]): Promise<PriceAuditLog[]> {
    return this.prisma.priceAuditLog.findMany({
      where: { decisionId: { in: decisionIds } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDecisionWithYacht(
    yachtId: string,
    weekStart: Date,
  ): Promise<
    | (PricingDecision & {
        yacht: {
          id: string;
          basePrice: Prisma.Decimal | null;
          maxDiscountPct: Prisma.Decimal | null;
        };
      })
    | null
  > {
    return this.prisma.pricingDecision.findUnique({
      where: { yachtId_weekStart: { yachtId, weekStart } },
      include: {
        yacht: { select: { id: true, basePrice: true, maxDiscountPct: true } },
      },
    });
  }

  async createDraftForYacht(
    yachtId: string,
    weekStart: Date,
  ): Promise<
    PricingDecision & {
      yacht: {
        id: string;
        basePrice: Prisma.Decimal | null;
        maxDiscountPct: Prisma.Decimal | null;
      };
    }
  > {
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
    });
  }

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

  async createAudit(
    decisionId: string,
    data: Omit<Prisma.PriceAuditLogCreateInput, 'decision'>,
  ): Promise<PriceAuditLog> {
    return this.prisma.priceAuditLog.create({
      data: { ...data, decisionId },
    });
  }

  /**
   * Выполняет callback в транзакции.
   * Используем корректный тип Prisma.TransactionClient.
   */
  tx<T>(cb: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(cb);
  }
}
