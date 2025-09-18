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

// ── helpers: расчёт пары и пр. ───────────────────────────────────────────────

// Тайп-guard: это Prisma.Decimal (или совместимый объект с toNumber(): number)
function isPrismaDecimal(x: unknown): x is Prisma.Decimal {
  return (
    x instanceof Prisma.Decimal ||
    (typeof x === 'object' &&
      x !== null &&
      'toNumber' in x &&
      typeof (x as { toNumber: unknown }).toNumber === 'function')
  );
}

// Привести unknown/Decimal/String к числу (если не получится — 0)
export const toNumberSafe = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (isPrismaDecimal(v)) return v.toNumber();
  return 0;
};

// type-guard: валидное число
export const isNum = (x: unknown): x is number =>
  typeof x === 'number' && Number.isFinite(x);

// Итоговая цена из базы и скидки (%). На входе — валидные числа.
export const calcFinal = (base: number, discountPct: number): number => {
  const k = 1 - discountPct / 100;
  return Math.round(Math.max(0, base * k));
};

// Скидка (%) из базы и финальной цены. На входе — валидные числа.
export const calcDiscountPct = (base: number, finalPrice: number): number => {
  if (base <= 0) return 0;
  const pct = (1 - finalPrice / base) * 100;
  return Number(pct.toFixed(1));
};

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
    const ws = weekStartUTC(new Date(dto.week));

    console.log('[SVC] changeStatus input DTO:', JSON.stringify({ ...dto }));

    // пробуем найти текущую запись
    let current = await this.prisma.pricingDecision.findUnique({
      where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
      include: { yacht: { select: { id: true, basePrice: true } } },
    });

    console.log(
      '[SVC] current decision:',
      current
        ? {
            id: current.id,
            status: current.status,
            basePrice: current.basePrice?.toString?.(),
            yachtId: current.yachtId,
          }
        : '(not found)',
    );

    // если записи нет, создаём её как DRAFT
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
      console.log('[SVC] created new decision draft:', {
        id: current.id,
        basePrice: current.basePrice?.toString?.(),
      });
    }

    const currentStatus = current?.status ?? DecisionStatus.DRAFT;
    console.log('[SVC] currentStatus:', currentStatus);

    const ctx: AccessCtx = await this.accessCtx.build(
      { id: user.id, role: user.role, orgId: user.orgId },
      dto.yachtId,
    );

    // RBAC
    if (dto.status === DecisionStatus.SUBMITTED) {
      if (!canSubmit(user, { status: currentStatus }, ctx)) {
        console.warn('[SVC] RBAC forbid Submit');
        throw new ForbiddenException('Недостаточно прав для Submit');
      }
    } else if (
      dto.status === DecisionStatus.APPROVED ||
      dto.status === DecisionStatus.REJECTED
    ) {
      if (!canApproveOrReject(user, { status: currentStatus }, ctx)) {
        console.warn('[SVC] RBAC forbid Approve/Reject');
        throw new ForbiddenException('Недостаточно прав для Approve/Reject');
      }
    }

    const toStatus = dto.status;
    console.log('[SVC] target status:', toStatus);

    // Тип аудита
    const auditAction: AuditAction | null =
      toStatus === DecisionStatus.SUBMITTED
        ? AuditAction.SUBMIT
        : toStatus === DecisionStatus.APPROVED
          ? AuditAction.APPROVE
          : toStatus === DecisionStatus.REJECTED
            ? AuditAction.REJECT
            : null;

    console.log('[SVC] audit action:', auditAction);

    // Транзакция
    const updated = await this.prisma.$transaction(async (tx) => {
      // 1) при SUBMIT пробуем обновить discount/final
      if (toStatus === DecisionStatus.SUBMITTED) {
        const base = toNumberSafe(current?.yacht?.basePrice);
        const nextDisc = dto.discountPct;
        const nextFinal = dto.finalPrice;

        console.log('[SVC] incoming pair:', { base, nextDisc, nextFinal });

        let newDiscountPct: number | undefined;
        let newFinalPrice: number | undefined;

        if (isNum(nextDisc)) {
          newDiscountPct = nextDisc;
          newFinalPrice = calcFinal(base, nextDisc);
        } else if (isNum(nextFinal)) {
          newFinalPrice = nextFinal;
          newDiscountPct = calcDiscountPct(base, nextFinal);
        }

        console.log('[SVC] resolved pair:', { newDiscountPct, newFinalPrice });

        if (newDiscountPct !== undefined || newFinalPrice !== undefined) {
          await tx.pricingDecision.update({
            where: {
              yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws },
            },
            data: {
              ...(newDiscountPct !== undefined
                ? { discountPct: new Prisma.Decimal(newDiscountPct) }
                : {}),
              ...(newFinalPrice !== undefined
                ? { finalPrice: new Prisma.Decimal(newFinalPrice) }
                : {}),
            },
          });
          console.log('[SVC] applied update with discount/final');
        }
      }

      // 2) обновляем статус
      const decision = await tx.pricingDecision.update({
        where: { yachtId_weekStart: { yachtId: dto.yachtId, weekStart: ws } },
        data: {
          status: toStatus,
          approvedAt: toStatus === DecisionStatus.APPROVED ? new Date() : null,
        },
        include: { yacht: true },
      });

      console.log('[SVC] updated decision status:', decision.status);

      // 3) пишем аудит
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
        console.log('[SVC] audit record created');
      }

      return decision;
    });

    const response: DecisionWithMeta = {
      ...updated,
      lastComment: dto.comment?.trim() || null,
      lastActionAt: new Date(),
    };

    console.log('[SVC] response prepared:', {
      id: response.id,
      status: response.status,
      discountPct: response.discountPct?.toString?.(),
      finalPrice: response.finalPrice?.toString?.(),
      lastComment: response.lastComment,
    });

    return response;
  }
}
