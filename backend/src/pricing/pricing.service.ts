// backend/src/pricing/pricing.service.ts

import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PricingRowsQueryDto,
  UpsertDecisionDto,
  ChangeStatusDto,
} from './pricing.dto';
import { AccessCtxService } from '../auth/access-ctx.service';
import {
  canSubmit,
  canApproveOrReject,
  canEditDraft,
  canReopen,
} from '../auth/policies';
import type { AccessCtx } from '../auth/access-ctx.service';
import {
  mapActualFields,
  mapSnapshot,
  mapDecision,
  buildMaps,
} from './pricing-mappers';
import {
  Prisma,
  DecisionStatus,
  User,
  AuditAction,
  ScrapeSource,
  WeekSlotStatus,
} from '@prisma/client';
import { PricingRepo, type YachtForRows } from './pricing.repo';
import { toNum } from '../common/decimal';
import type { PricingRowDto } from './pricing-row.dto';
import { getEffectiveBasePriceForWeek } from '../pricing-decisions/effective-base-price.helper';
import type { AuditAction as AuditActionType } from '@prisma/client';

// ── helpers ──────────────────────────────────────────────────────────────────
import {
  weekStartUTC,
  isPrismaDecimal,
  resolveDiscountPair,
  ensureWithinMaxDiscount,
  asDecimalPair,
} from './pricing-utils';

// ==========================================
// Тип-ответ для changeStatus: решение + лодка + мета-поля
type DecisionWithMeta = Prisma.PricingDecisionGetPayload<{
  include: { yacht: true };
}> & {
  lastComment: string | null;
  lastActionAt: Date | null;
};

@Injectable()
export class PricingService {
  constructor(
    private prisma: PrismaService,
    private accessCtx: AccessCtxService,
    private repo: PricingRepo,
  ) {}

  /** Табличка по флоту на неделю: базовая цена, снапшот, черновик решения,
   *  perms, комментарии и предложка mlReco
   */
  async rows(q: PricingRowsQueryDto, user: User): Promise<PricingRowDto[]> {
    const ws = weekStartUTC(new Date(q.week));

    // Нормализуем источник (если передан), иначе оставляем undefined —
    // репозиторий сам решит, что считать дефолтом.
    const source: ScrapeSource | undefined = q.source ?? undefined;

    // 1) Яхты
    const yachts: YachtForRows[] = await this.repo.listYachts();
    if (yachts.length === 0) return [];

    const yachtIds = yachts.map((y) => y.id);

    // 2) Данные недели (снимки конкурентов, решения, слоты)
    const [snaps, decisions, weekSlots] = await Promise.all([
      this.repo.listSnapshots(ws, source),
      this.repo.listDecisions(ws),
      this.repo.listWeekSlots(ws, yachtIds),
    ]);

    const { snapByYacht, decByYacht, slotByYacht } = buildMaps({
      snaps,
      decisions,
      weekSlots,
    });

    // 3) Последний аудит на каждое решение
    const decisionIds = Array.from(new Set(decisions.map((d) => d.id)));
    const lastAuditByDecision = new Map<
      string,
      { comment: string | null; createdAt: Date }
    >();

    if (decisionIds.length > 0) {
      const audits = await this.repo.listLastAudits(decisionIds);
      for (const a of audits) {
        if (!lastAuditByDecision.has(a.decisionId)) {
          lastAuditByDecision.set(a.decisionId, {
            comment: a.comment ?? null,
            createdAt: a.createdAt,
          });
        }
      }
    }

    // 4) Сборка строк (for-of, чтобы не плодить async-map)
    const rows: PricingRowDto[] = [];

    for (const y of yachts) {
      const s = snapByYacht.get(y.id) ?? null;
      const d = decByYacht.get(y.id) ?? null;
      const status = d?.status ?? DecisionStatus.DRAFT;

      // контекст доступа для этой лодки
      const ctx: AccessCtx = await this.accessCtx.build(
        { id: user.id, role: user.role, orgId: user.orgId },
        y.id,
      );

      // права на действия
      const perms = {
        canEditDraft: canEditDraft(user, { status }, ctx),
        canSubmit: canSubmit(user, { status }, ctx),
        canApproveOrReject: canApproveOrReject(user, { status }, ctx),
        canReopen: canReopen(user, { status }, ctx),
      };

      // рекомендация = top3Avg, если есть
      const mlReco = s?.top3Avg ?? null;

      // 🔹 Эффективная базовая цена + данные решения (для факта)
      const effectiveBase = await getEffectiveBasePriceForWeek(this.prisma, {
        yachtId: y.id,
        weekStart: ws,
      });

      const baseDecimal = effectiveBase.price ?? y.basePrice;

      // если у решения есть discountPct, пересчитаем итог (если finalPrice не задан)
      let finalPrice = d?.finalPrice ?? null;
      if (finalPrice == null && d?.discountPct != null) {
        finalPrice = baseDecimal.mul(
          new Prisma.Decimal(1).sub(d.discountPct.div(100)),
        );
      }

      const lastAudit = d?.id ? lastAuditByDecision.get(d.id) : undefined;
      const slot = slotByYacht.get(y.id);

      // маппинги к примитивам
      const snapshot = mapSnapshot(s);
      const decision = mapDecision(d);

      const { actualPrice, actualDiscountPct, priceFetchedAt } =
        mapActualFields(slot);

      // Decimal → number | null
      const maxDiscountPercent = toNum(y.maxDiscountPct);

      rows.push({
        yachtId: y.id,
        name: y.name,
        // 🔹 на фронт отдаём уже эффективную базовую цену
        basePrice: baseDecimal,
        snapshot,
        decision,
        actualPrice,
        actualDiscountPercent: actualDiscountPct,
        fetchedAt: priceFetchedAt,
        maxDiscountPercent,

        // последний комментарий и время действия (ISO-строка под DTO)
        lastComment: lastAudit?.comment ?? null,
        lastActionAt: lastAudit?.createdAt
          ? lastAudit.createdAt.toISOString()
          : null,

        mlReco,
        finalPrice,
        perms,
      });
    }

    return rows;
  }

  /** Создать/обновить черновик решения на неделю для лодки (RBAC: canEditDraft) */
  async upsertDecision(dto: UpsertDecisionDto, user: User) {
    const ws = weekStartUTC(new Date(dto.week));

    // текущая базовая цена лодки и id (исходная)
    const yacht = await this.prisma.yacht.findUniqueOrThrow({
      where: { id: dto.yachtId },
      select: { basePrice: true, id: true, maxDiscountPct: true },
    });

    // 🔹 Эффективная базовая цена на эту неделю
    const effectiveBase = await getEffectiveBasePriceForWeek(this.prisma, {
      yachtId: dto.yachtId,
      weekStart: ws,
    });
    const baseDecimal =
      effectiveBase.price ?? yacht.basePrice ?? new Prisma.Decimal(0);

    // узнать текущий статус (если запись уже есть)
    const current = await this.prisma.pricingDecision.findUnique({
      where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
      select: { status: true },
    });
    const currentStatus = current?.status ?? DecisionStatus.DRAFT;

    // контекст + RBAC
    const ctx: AccessCtx = await this.accessCtx.build(
      { id: user.id, role: user.role, orgId: user.orgId },
      yacht.id,
    );
    if (!canEditDraft(user, { status: currentStatus }, ctx)) {
      throw new ForbiddenException('Недостаточно прав для изменения черновика');
    }

    const base = baseDecimal.toNumber();

    // нормализуем пару (если задан один параметр)
    const normalized = resolveDiscountPair(
      base,
      dto.discountPct,
      dto.finalPrice,
    );
    const decPair = asDecimalPair({
      discountPct: normalized.discountPct ?? dto.discountPct,
      finalPrice: normalized.finalPrice ?? dto.finalPrice,
    });

    // upsert
    await this.prisma.pricingDecision.upsert({
      where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
      create: {
        yachtId: dto.yachtId,
        weekStart: ws,
        basePrice: new Prisma.Decimal(base),
        discountPct: decPair.discountPct ?? null,
        finalPrice: decPair.finalPrice ?? null,
        status: DecisionStatus.DRAFT,
      },
      update: {
        discountPct: decPair.discountPct ?? null,
        finalPrice: decPair.finalPrice ?? null,
      },
    });

    // возвращаем запись с лодкой
    return this.prisma.pricingDecision.findUnique({
      where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
      include: { yacht: true },
    });
  }

  /** Смена статуса решения (RBAC: canSubmit / canApproveOrReject) + аудит */
  async changeStatus(
    dto: ChangeStatusDto,
    user: User,
  ): Promise<DecisionWithMeta> {
    const ws = weekStartUTC(new Date(dto.week));
    const toStatus = dto.status;

    // 1) Текущая запись (или создаём черновик)
    let current = await this.repo.getDecisionWithYacht(dto.yachtId, ws);
    if (!current) {
      current = await this.repo.createDraftForYacht(dto.yachtId, ws);
    }
    const currentStatus = current.status ?? DecisionStatus.DRAFT;

    // 2) RBAC
    const ctx: AccessCtx = await this.accessCtx.build(
      { id: user.id, role: user.role, orgId: user.orgId },
      dto.yachtId,
    );

    if (toStatus === DecisionStatus.SUBMITTED) {
      if (!canSubmit(user, { status: currentStatus }, ctx)) {
        throw new ForbiddenException('Недостаточно прав для Submit');
      }
    } else if (
      toStatus === DecisionStatus.APPROVED ||
      toStatus === DecisionStatus.REJECTED
    ) {
      if (!canApproveOrReject(user, { status: currentStatus }, ctx)) {
        throw new ForbiddenException('Недостаточно прав для Approve/Reject');
      }
    } else if (toStatus === DecisionStatus.DRAFT) {
      // REOPEN: разрешаем только APPROVED → DRAFT
      if (currentStatus !== DecisionStatus.APPROVED) {
        throw new ForbiddenException('Invalid source status for Reopen');
      }
      if (!canReopen(user, { status: currentStatus }, ctx)) {
        throw new ForbiddenException('Недостаточно прав для Reopen');
      }
    } else {
      throw new ForbiddenException('Недопустимая смена статуса');
    }

    // 3) Расчёт пары (discount/final) и проверка лимита скидки
    let newDiscountPct: number | undefined;
    let newFinalPrice: number | undefined;

    if (toStatus === DecisionStatus.SUBMITTED) {
      // 🔹 Эффективная базовая цена на эту неделю
      const effectiveBase = await getEffectiveBasePriceForWeek(this.prisma, {
        yachtId: dto.yachtId,
        weekStart: ws,
      });

      const base = toNum(effectiveBase.price ?? current.yacht?.basePrice) ?? 0;

      const pair = resolveDiscountPair(base, dto.discountPct, dto.finalPrice);
      newDiscountPct = pair.discountPct;
      newFinalPrice = pair.finalPrice;

      const maxLimit = toNum(current.yacht?.maxDiscountPct);

      const effectiveDiscount =
        newDiscountPct ??
        (isPrismaDecimal(current.discountPct)
          ? current.discountPct.toNumber()
          : undefined);

      ensureWithinMaxDiscount(maxLimit, effectiveDiscount);
    }

    // 4) Транзакция: (а) при SUBMIT — обновить пару; (б) статус + аудит; (в) при APPROVED — актуал/история
    const updated = await this.repo.tx(async (tx) => {
      // (а) при SUBMIT — применяем discount/final, если заданы
      if (
        toStatus === DecisionStatus.SUBMITTED &&
        (newDiscountPct !== undefined || newFinalPrice !== undefined)
      ) {
        await tx.pricingDecision.update({
          where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
          data: {
            ...(newDiscountPct !== undefined
              ? { discountPct: new Prisma.Decimal(newDiscountPct) }
              : {}),
            ...(newFinalPrice !== undefined
              ? { finalPrice: new Prisma.Decimal(newFinalPrice) }
              : {}),
          },
        });
      }

      // (б) статус
      const decision = await tx.pricingDecision.update({
        where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
        data: {
          status: toStatus,
          approvedAt: toStatus === DecisionStatus.APPROVED ? new Date() : null,
          approvedBy: toStatus === DecisionStatus.APPROVED ? user.id : null,
        },
        include: { yacht: true },
      });

      // (в) аудит
      let auditAction: AuditActionType | null = null;

      switch (toStatus) {
        case DecisionStatus.SUBMITTED:
          auditAction = AuditAction.SUBMIT;
          break;

        case DecisionStatus.APPROVED:
          auditAction = AuditAction.APPROVE;
          break;

        case DecisionStatus.REJECTED:
          auditAction = AuditAction.REJECT;
          break;

        case DecisionStatus.DRAFT:
          if (currentStatus === DecisionStatus.APPROVED) {
            auditAction = AuditAction.REOPEN;
          }
          break;
      }

      if (auditAction) {
        await tx.priceAuditLog.create({
          data: {
            decisionId: decision.id,
            action: auditAction,
            fromStatus: currentStatus,
            toStatus,
            actorId: user.id,
            comment: dto.comment?.trim() || null,
          },
        });
      }

      // (г) при APPROVED фиксируем цену в WeekSlot и пишем PriceHistory
      if (toStatus === DecisionStatus.APPROVED) {
        // страхуемся: к моменту APPROVED пара должна быть заполнена
        if (decision.finalPrice == null || decision.discountPct == null) {
          throw new ForbiddenException(
            'finalPrice and discountPct must be set before Approve',
          );
        }

        const finalPrice = decision.finalPrice;
        const discountPct = decision.discountPct;
        const weekStart = decision.weekStart; // Date
        const yachtId = decision.yachtId;
        const now = new Date();
        const note = dto.comment?.trim() || null;

        // 1) Ищем WeekSlot по (yachtId, weekStart)
        let weekSlot = await tx.weekSlot.findUnique({
          where: {
            yachtId_startDate: {
              yachtId,
              startDate: weekStart,
            },
          },
        });

        // 2) Если слота нет — создаём
        if (!weekSlot) {
          weekSlot = await tx.weekSlot.create({
            data: {
              yachtId,
              startDate: weekStart,
              status: WeekSlotStatus.OPEN,
              currentPrice: finalPrice,
              currentDiscount: discountPct,
              priceFetchedAt: now,
              // priceSource: можно добавить позже, когда зафиксируешь enum
            },
          });
        } else {
          // 3) Если слот есть — обновляем фактическую цену/скидку
          weekSlot = await tx.weekSlot.update({
            where: { id: weekSlot.id },
            data: {
              currentPrice: finalPrice,
              currentDiscount: discountPct,
              priceFetchedAt: now,
              // priceSource: позже
            },
          });
        }

        // 4) Пишем запись в историю цен
        await tx.priceHistory.create({
          data: {
            weekSlotId: weekSlot.id,
            price: finalPrice,
            discount: discountPct,
            // source: 'INTERNAL', // когда заведём PriceSource.INTERNAL
            authorId: user.id,
            note,
            date: now,
          },
        });
      }

      // возвращаем решение, чтобы выйти из транзакции
      return decision;
    });

    // 5) Ответ + мета
    const response: DecisionWithMeta = {
      ...updated,
      lastComment: dto.comment?.trim() || null,
      lastActionAt: new Date(),
    };

    return response;
  }
}
