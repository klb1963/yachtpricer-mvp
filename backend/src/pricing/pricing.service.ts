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

@Injectable()
export class PricingService {
  constructor(
    private prisma: PrismaService,
    private accessCtx: AccessCtxService,
  ) {}

  /** Табличка по флоту на неделю: базовая цена, снапшот, черновик решения, perms и предложка mlReco */
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

    return Promise.all(
      yachts.map(async (y) => {
        const s = snapByYacht.get(y.id);
        const d = decByYacht.get(y.id);
        const status = d?.status ?? DecisionStatus.DRAFT;

        const ctx: AccessCtx = await this.accessCtx.build(
          { id: user.id, role: user.role },
          y.id,
        );

        const perms = {
          canSubmit: canSubmit(user, { status }, ctx),
          canApproveOrReject: canApproveOrReject(user, { status }, ctx),
        };

        const mlReco = s?.top3Avg ?? null;

        let finalPrice = d?.finalPrice ?? null;
        if (finalPrice == null && d?.discountPct != null) {
          finalPrice = y.basePrice.mul(
            new Prisma.Decimal(1).sub(d.discountPct.div(100)),
          );
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

    // RBAC
    const ctx: AccessCtx = await this.accessCtx.build(
      { id: user.id, role: user.role },
      yacht.id,
    );
    if (!canEditDraft(user, { status: currentStatus }, ctx)) {
      throw new ForbiddenException('Недостаточно прав для изменения черновика');
    }

    const basePriceDecimal = yacht.basePrice ?? new Prisma.Decimal(0);

    const discountDec =
      dto.discountPct != null ? new Prisma.Decimal(dto.discountPct) : null;
    const finalPriceDec =
      dto.finalPrice != null ? new Prisma.Decimal(dto.finalPrice) : null;

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

    return this.prisma.pricingDecision.findUnique({
      where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
      include: { yacht: true },
    });
  }

  /** Смена статуса решения (RBAC: canSubmit / canApproveOrReject) + аудит */
  async changeStatus(dto: ChangeStatusDto, user: User) {
    const ws = weekStartUTC(new Date(dto.week));

    // ⚠️ пробуем найти текущую запись
    let current = await this.prisma.pricingDecision.findUnique({
      where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
      include: { yacht: { select: { id: true, basePrice: true } } }, // ← добавим basePrice
    });

    // ✅ если записи нет, и это первый шаг (часто SUBMITTED), создадим её на лету
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
          status: DecisionStatus.DRAFT, // создаём как DRAFT, дальше RBAC решит можно ли менять
        },
        include: { yacht: { select: { id: true, basePrice: true } } },
      });
    }

    const currentStatus = current?.status ?? DecisionStatus.DRAFT;

    const ctx: AccessCtx = await this.accessCtx.build(
      { id: user.id, role: user.role },
      dto.yachtId,
    );

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

    const auditAction: AuditAction | null =
      toStatus === DecisionStatus.SUBMITTED
        ? AuditAction.SUBMIT
        : toStatus === DecisionStatus.APPROVED
          ? AuditAction.APPROVE
          : toStatus === DecisionStatus.REJECTED
            ? AuditAction.REJECT
            : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const decision = await tx.pricingDecision.update({
        where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
        data: {
          status: toStatus,
          approvedAt: toStatus === DecisionStatus.APPROVED ? new Date() : null,
        },
        include: { yacht: true },
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

    return updated;
  }
}
