// backend/src/pricing/pricing.service.ts

import { Injectable, ForbiddenException } from '@nestjs/common';
import { Prisma, DecisionStatus, User, AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PricingRowsQueryDto,
  UpsertDecisionDto,
  ChangeStatusDto,
} from './pricing.dto';
import { AccessCtxService } from '../auth/access-ctx.service';
import { canSubmit, canApproveOrReject, canEditDraft } from '../auth/policies';
import type { AccessCtx } from '../auth/access-ctx.service';

/** Суббота 00:00 UTC для заданной даты */
function weekStartUTC(d: Date) {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = x.getUTCDay(); // 0..6 (вск..сб)
  const diff = (day - 6 + 7) % 7; // до субботы
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

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
  ) {}

  /** Табличка по флоту на неделю: базовая цена, снапшот, черновик решения, perms, комментарии и предложка mlReco */
  async rows(q: PricingRowsQueryDto, user: User) {
    const ws = weekStartUTC(new Date(q.week));

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
        orgId: true,
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

    // ✨ Подтянем последний комментарий/время действия по каждому решению
    const decisionIds = decisions.map((d) => d.id);
    const lastAuditByDecision = new Map<
      string,
      { comment: string | null; createdAt: Date }
    >();
    if (decisionIds.length > 0) {
      const audits = await this.prisma.priceAuditLog.findMany({
        where: { decisionId: { in: decisionIds } },
        orderBy: { createdAt: 'desc' },
      });
      for (const a of audits) {
        // запомним только самый свежий по decisionId
        if (!lastAuditByDecision.has(a.decisionId)) {
          lastAuditByDecision.set(a.decisionId, {
            comment: a.comment ?? null,
            createdAt: a.createdAt,
          });
        }
      }
    }

    // Собираем финальную строку по каждой лодке
    return Promise.all(
      yachts.map(async (y) => {
        const s = snapByYacht.get(y.id);
        const d = decByYacht.get(y.id);
        const status = d?.status ?? DecisionStatus.DRAFT;

        // контекст доступа для этой лодки
        const ctx: AccessCtx = await this.accessCtx.build(
          { id: user.id, role: user.role, orgId: user.orgId },
          y.id,
        );

        // права на действия (только вычисляем и возвращаем во фронт)
        const perms = {
          canEditDraft: canEditDraft(user, { status }, ctx),
          canSubmit: canSubmit(user, { status }, ctx),
          canApproveOrReject: canApproveOrReject(user, { status }, ctx),
        };

        // простая эвристика: рекомендация = top3Avg, если есть
        const mlReco = s?.top3Avg ?? null;

        // если у решения есть discountPct, пересчитаем итог (если finalPrice не задан)
        let finalPrice = d?.finalPrice ?? null;
        if (finalPrice == null && d?.discountPct != null) {
          finalPrice = y.basePrice.mul(
            new Prisma.Decimal(1).sub(d.discountPct.div(100)),
          );
        }

        const lastAudit = d?.id ? lastAuditByDecision.get(d.id) : undefined;

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
          // ✨ последние комментарий и время действия
          lastComment: lastAudit?.comment ?? null,
          lastActionAt: lastAudit?.createdAt ?? null,
          mlReco,
          finalPrice,
          perms,
        };
      }),
    );
  }

  /** Создать/обновить черновик решения на неделю для лодки (RBAC: canEditDraft) */
  async upsertDecision(dto: UpsertDecisionDto, user: User) {
    const ws = weekStartUTC(new Date(dto.week));

    // текущая базовая цена лодки и id
    const yacht = await this.prisma.yacht.findUniqueOrThrow({
      where: { id: dto.yachtId },
      select: { basePrice: true, id: true },
    });

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

    const basePriceDecimal = yacht.basePrice ?? new Prisma.Decimal(0);

    // приводим входные числа к Decimal (или null)
    const discountDec =
      dto.discountPct != null ? new Prisma.Decimal(dto.discountPct) : null;
    const finalPriceDec =
      dto.finalPrice != null ? new Prisma.Decimal(dto.finalPrice) : null;

    // upsert
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
    console.log('[SVC] changeStatus input:', dto);
    const ws = weekStartUTC(new Date(dto.week));

    // пробуем найти текущую запись
    let current = await this.prisma.pricingDecision.findUnique({
      where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
      include: { yacht: { select: { id: true, basePrice: true } } },
    });

    // если записи нет, создаём её как DRAFT (частый случай при первом SUBMIT)
    if (!current) {
      const yacht = await this.prisma.yacht.findUniqueOrThrow({
        where: { id: dto.yachtId },
        select: { id: true, basePrice: true },
      });
      current = await this.prisma.pricingDecision.create({
        data: {
          yachtId: dto.yachtId,
          weekStart: ws,
          basePrice: yacht.basePrice ?? new Prisma.Decimal(0),
          status: DecisionStatus.DRAFT,
        },
        include: { yacht: { select: { id: true, basePrice: true } } },
      });
    }

    const currentStatus = current?.status ?? DecisionStatus.DRAFT;

    const ctx: AccessCtx = await this.accessCtx.build(
      { id: user.id, role: user.role, orgId: user.orgId },
      dto.yachtId,
    );

    // RBAC
    if (dto.status === DecisionStatus.SUBMITTED) {
      if (!canSubmit(user, { status: currentStatus }, ctx)) {
        throw new ForbiddenException('Недостаточно прав для Submit');
      }
    } else if (
      dto.status === DecisionStatus.APPROVED ||
      dto.status === DecisionStatus.REJECTED
    ) {
      if (!canApproveOrReject(user, { status: currentStatus }, ctx)) {
        throw new ForbiddenException('Недостаточно прав для Approve/Reject');
      }
    }

    const toStatus = dto.status;

    // Тип аудита
    const auditAction: AuditAction | null =
      toStatus === DecisionStatus.SUBMITTED
        ? AuditAction.SUBMIT
        : toStatus === DecisionStatus.APPROVED
          ? AuditAction.APPROVE
          : toStatus === DecisionStatus.REJECTED
            ? AuditAction.REJECT
            : null;

    console.log('[SVC] create audit with comment:', dto.comment);
    // Транзакция: обновляем статус + пишем аудит
    const updated = await this.prisma.$transaction(async (tx) => {
      const decision = await tx.pricingDecision.update({
        where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
        data: {
          status: toStatus,
          approvedAt: toStatus === DecisionStatus.APPROVED ? new Date() : null,
        },
        include: { yacht: true },
      });

      console.log('[AUDIT]', {
        comment: dto.comment,
        trimmed: dto.comment?.trim(),
      });

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

      return decision;
    });

    // Вернём также последний комментарий/время действия
    const response: DecisionWithMeta = {
      ...updated,
      lastComment: dto.comment?.trim() || null,
      lastActionAt: new Date(),
    };

    return response;
  }
}
