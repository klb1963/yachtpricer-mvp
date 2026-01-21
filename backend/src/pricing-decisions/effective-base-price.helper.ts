// backend/src/pricing-decisions/effective-base-price.helper.ts

import { PrismaClient, Prisma } from '@prisma/client';

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
 * Новая логика (PriceListNode):
 * 1) Ищем последний узел прайса (PriceListNode) по этой яхте с weekStart <= targetWeekStart.
 * 2) Если нашли — берём из него price (это "Price List" для недели).
 * 3) Если узлов прайса нет — fallback на yacht.basePrice.
 */
export async function getEffectiveBasePriceForWeek(
  prisma: PrismaClient,
  params: { yachtId: string; weekStart: Date },
): Promise<EffectiveBasePriceResult> {
  const { yachtId, weekStart } = params;

  // 1) Последний узел прайса до/на эту неделю
  const node = await prisma.priceListNode.findFirst({
    where: {
      yachtId,
      weekStart: { lte: weekStart },
    },
    orderBy: {
      weekStart: 'desc',
    },
    select: {
      price: true,
      weekStart: true,
    },
  });

  if (node && node.price != null) {
    return {
      price: node.price,
      // база больше не вычисляется из decision → оставляем мета-поля пустыми
      fromDecisionId: null,
      fromWeekStart: node.weekStart,
      discountPct: null,
      approvedAt: null,
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
