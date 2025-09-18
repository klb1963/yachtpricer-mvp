// backend/src/pricing-decisions/pricing-decisions.controller.ts
import {
  Controller,
  Param,
  Post,
  Get,
  Body,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessCtxService } from '../auth/access-ctx.service';
import {
  canSubmit,
  canApproveOrReject,
  canView,
  canEditDraft,
} from '../auth/policies';
import { RejectDto } from './dto';
import { DecisionStatus, AuditAction, User } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator'; // ← ВАЖНО

const asDecisionStatus = (s: string) => s as DecisionStatus;

@Controller('pricing-decisions')
@Roles('MANAGER', 'FLEET_MANAGER', 'ADMIN')
export class PricingDecisionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessCtx: AccessCtxService,
  ) {}

  // Список решений + права (берём актёра из req.user)
  @Get('list/with-perms')
  async listWithPerms(@CurrentUser() actor: User) {
    const decisions = await this.prisma.pricingDecision.findMany();
    return Promise.all(
      decisions.map(async (d) => {
        const ctx = await this.accessCtx.build(actor, d.yachtId);
        return {
          decision: d,
          perms: {
            canView: canView(actor, ctx),
            canEditDraft: canEditDraft(actor, { status: d.status }, ctx),
            canSubmit: canSubmit(actor, d, ctx),
            canApproveOrReject: canApproveOrReject(actor, d, ctx),
          },
        };
      }),
    );
  }

  // Одно решение + права
  @Get(':id/with-perms')
  async withPerms(@Param('id') id: string, @CurrentUser() actor: User) {
    const decision = await this.prisma.pricingDecision.findUnique({
      where: { id },
    });
    if (!decision) throw new NotFoundException('Decision not found');

    const ctx = await this.accessCtx.build(actor, decision.yachtId);
    return {
      decision,
      perms: {
        canView: canView(actor, ctx),
        canEditDraft: canEditDraft(actor, { status: decision.status }, ctx),
        canSubmit: canSubmit(actor, decision, ctx),
        canApproveOrReject: canApproveOrReject(actor, decision, ctx),
      },
    };
  }

  @Post(':id/submit')
  async submit(@Param('id') id: string, @CurrentUser() actor: User) {
    const decision = await this.prisma.pricingDecision.findUnique({
      where: { id },
    });
    if (!decision) throw new NotFoundException('Decision not found');

    const ctx = await this.accessCtx.build(actor, decision.yachtId);
    if (!canSubmit(actor, decision, ctx)) throw new ForbiddenException();

    const status = asDecisionStatus(decision.status);
    if (status !== DecisionStatus.DRAFT && status !== DecisionStatus.REJECTED) {
      throw new ForbiddenException('Invalid source status');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.pricingDecision.update({
        where: { id },
        data: { status: DecisionStatus.SUBMITTED },
      });
      await tx.priceAuditLog.create({
        data: {
          decisionId: id,
          action: AuditAction.SUBMIT,
          fromStatus: status,
          toStatus: DecisionStatus.SUBMITTED,
          actorId: actor.id,
          comment: 'Submitted',
        },
      });
      return u;
    });

    return updated;
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @CurrentUser() actor: User) {
    const decision = await this.prisma.pricingDecision.findUnique({
      where: { id },
    });
    if (!decision) throw new NotFoundException('Decision not found');

    const ctx = await this.accessCtx.build(actor, decision.yachtId);
    if (!canApproveOrReject(actor, decision, ctx))
      throw new ForbiddenException();

    const status = asDecisionStatus(decision.status);
    if (status !== DecisionStatus.SUBMITTED)
      throw new ForbiddenException('Invalid source status');

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.pricingDecision.update({
        where: { id },
        data: {
          status: DecisionStatus.APPROVED,
          approvedBy: actor.id,
          approvedAt: new Date(),
        },
      });
      await tx.priceAuditLog.create({
        data: {
          decisionId: id,
          action: AuditAction.APPROVE,
          fromStatus: status,
          toStatus: DecisionStatus.APPROVED,
          actorId: actor.id,
          comment: 'Approved',
        },
      });
      return u;
    });

    return updated;
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser() actor: User,
    @Body() body: RejectDto,
  ) {
    if (!body.comment?.trim())
      throw new ForbiddenException('Reject requires a comment');

    const decision = await this.prisma.pricingDecision.findUnique({
      where: { id },
    });
    if (!decision) throw new NotFoundException('Decision not found');

    const ctx = await this.accessCtx.build(actor, decision.yachtId);
    if (!canApproveOrReject(actor, decision, ctx))
      throw new ForbiddenException();

    const status = asDecisionStatus(decision.status);
    if (status !== DecisionStatus.SUBMITTED)
      throw new ForbiddenException('Invalid source status');

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.pricingDecision.update({
        where: { id },
        data: { status: DecisionStatus.REJECTED },
      });
      await tx.priceAuditLog.create({
        data: {
          decisionId: id,
          action: AuditAction.REJECT,
          fromStatus: status,
          toStatus: DecisionStatus.REJECTED,
          actorId: actor.id,
          comment: body.comment,
        },
      });
      return u;
    });

    return updated;
  }
}
