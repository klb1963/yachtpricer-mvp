import { DecisionStatus } from '@prisma/client';

export class ActorDto {
  actorId!: string;
}

export class RejectDto extends ActorDto {
  comment!: string;
}

// ─ Pending decisions (для in-app уведомлений) ─

export class PendingPricingDecisionItemDto {
  id!: string;
  yachtId!: string;
  /** Короткое название/ярлык яхты для отображения в UI */
  yachtLabel!: string | null;
  /** Дата начала недели в формате YYYY-MM-DD (ISO без времени) */
  weekStart!: string;
  status!: DecisionStatus;
}

export class PendingPricingDecisionsResponseDto {
  count!: number;
  items!: PendingPricingDecisionItemDto[];
}
