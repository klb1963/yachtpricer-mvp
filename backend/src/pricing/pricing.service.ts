// backend/src/pricing/pricing.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { Prisma, DecisionStatus, User } from '@prisma/client';
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

    // Собираем финальную строку по каждой лодке
    return Promise.all(
      yachts.map(async (y) => {
        const s = snapByYacht.get(y.id);
        const d = decByYacht.get(y.id);
        const status = d?.status ?? 'DRAFT';

        // контекст доступа для этой лодки
        const ctx: AccessCtx = await this.accessCtx.build(
          { id: user.id, role: user.role },
          y.id,
        );

        // права на действия (только вычисляем и возвращаем в фронт)
        const perms = {
          canSubmit: canSubmit(user, { status }, ctx),
          canApproveOrReject: canApproveOrReject(user, { status }, ctx),
        };

        // простая эвристика: рекомендация = top3Avg, если есть
        const mlReco = s?.top3Avg ?? null;

        // если у решения есть discountPct, пересчитаем итог (если finalPrice не задан)
        let finalPrice = d?.finalPrice ?? null;
        if (finalPrice == null && d?.discountPct != null) {
          // Decimal-арифметика
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
          perms, // ← добавили для фронта
        };
      }),
    );
  }

  /** Создать/обновить черновик решения на неделю для лодки (RBAC: canEditDraft) */
  async upsertDecision(dto: UpsertDecisionDto, user: User) {
    const ws = weekStartUTC(new Date(dto.week));

    // текущая базовая цена лодки в Decimal и orgId
    const yacht = await this.prisma.yacht.findUniqueOrThrow({
      where: { id: dto.yachtId },
      select: { basePrice: true, orgId: true, id: true },
    });

    // RBAC: редактировать черновик могут ADMIN/FLEET_MANAGER всегда,
    // MANAGER — только свой объект (ctx.isManagerOfYacht)
    const ctx: AccessCtx = await this.accessCtx.build(
      { id: user.id, role: user.role },
      yacht.id,
    );
    if (!canEditDraft(user, { status: 'DRAFT' }, ctx)) {
      throw new ForbiddenException('Недостаточно прав для изменения черновика');
    }

    const basePriceDecimal = yacht.basePrice ?? new Prisma.Decimal(0);

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

  /** Смена статуса решения (RBAC: canSubmit / canApproveOrReject) */
  async changeStatus(dto: ChangeStatusDto, user: User) {
    const ws = weekStartUTC(new Date(dto.week));

    // найдём текущую запись/статус и контекст
    const current = await this.prisma.pricingDecision.findUnique({
      where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
      include: { yacht: { select: { id: true, orgId: true } } },
    });

    const currentStatus = current?.status ?? 'DRAFT';
    const ctx: AccessCtx = await this.accessCtx.build(
      { id: user.id, role: user.role },
      dto.yachtId,
    );

    // RBAC
    if (dto.status === 'SUBMITTED') {
      if (!canSubmit(user, { status: currentStatus }, ctx)) {
        throw new ForbiddenException('Недостаточно прав для Submit');
      }
    } else if (dto.status === 'APPROVED' || dto.status === 'REJECTED') {
      if (!canApproveOrReject(user, { status: currentStatus }, ctx)) {
        throw new ForbiddenException('Недостаточно прав для Approve/Reject');
      }
    } // переход в DRAFT обычно разрешаем тем, кто может редактировать черновик

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
