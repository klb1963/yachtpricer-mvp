// backend/src/pricing-decisions/effective-base-price.helper.ts

import { PrismaClient, DecisionStatus, Prisma } from '@prisma/client';

export type EffectiveBasePriceResult = {
  /** Итоговая "эффективная" базовая цена на выбранную неделю */
  price: Prisma.Decimal | null;
  /** От какого решения эта цена взята (если есть) */
  fromDecisionId?: string | null;
  /** Неделя, для которой это решение было утверждено */
  fromWeekStart?: Date | null;
  /** Скидка из решения (если была указана) */
  discountPct?: Prisma.Decimal | null;
  /** Момент утверждения решения (для "Согласовано") */
  approvedAt?: Date | null;
};

/**
 * Возвращает "эффективную" базовую цену для яхты на указанную неделю.
 *
 * Алгоритм:
 * 1) Ищем последнее APPROVED-решение по этой яхте с weekStart <= targetWeekStart.
 * 2) Если нашли — берём из него finalPrice.
 * 3) Если нет решений — возвращаем yacht.basePrice.
 */
export async function getEffectiveBasePriceForWeek(
  prisma: PrismaClient,
  params: { yachtId: string; weekStart: Date },
): Promise<EffectiveBasePriceResult> {
  const { yachtId, weekStart } = params;

  // 1) Последнее APPROVED-решение до/на эту неделю
  const decision = await prisma.pricingDecision.findFirst({
    where: {
      yachtId,
      status: DecisionStatus.APPROVED,
      weekStart: { lte: weekStart },
      finalPrice: { not: null },
    },
    orderBy: {
      weekStart: 'desc',
    },
  });

  if (decision && decision.finalPrice != null) {
    return {
      price: decision.finalPrice,
      fromDecisionId: decision.id,
      fromWeekStart: decision.weekStart,
      discountPct: decision.discountPct ?? null,
      approvedAt: decision.approvedAt ?? null,
    };
  }

  // 2) Fallback — исходная базовая цена из самой яхты
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
    select: { basePrice: true },
  });

  return {
    price: yacht?.basePrice ?? null,
    fromDecisionId: null,
    fromWeekStart: null,
    discountPct: null,
    approvedAt: null,
  };
}
