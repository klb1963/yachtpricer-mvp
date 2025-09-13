import {
  Controller,
  Param,
  Post,
  Get,
  Query,
  Body,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessCtxService } from '../auth/access-ctx.service';
import { canSubmit, canApproveOrReject, canView } from '../auth/policies';
import { ActorDto, RejectDto } from './dto';
import { DecisionStatus, AuditAction } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';

// удобный хелпер для каста string -> DecisionStatus
const asDecisionStatus = (s: string) => s as DecisionStatus;

@Controller('pricing-decisions')
@Roles('MANAGER', 'ADMIN')
export class PricingDecisionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessCtx: AccessCtxService,
  ) {}

  // Возвращает решение + флаги can*
  @Get(':id/with-perms')
  async withPerms(@Param('id') id: string, @Query('actorId') actorId: string) {
    const decision = await this.prisma.pricingDecision.findUnique({
      where: { id },
    });
    if (!decision) throw new NotFoundException('Decision not found');

    const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
    if (!actor) throw new NotFoundException('Actor not found');

    const ctx = await this.accessCtx.build(actor, decision.yachtId);

    return {
      decision,
      perms: {
        canView: canView(actor, ctx),
        canSubmit: canSubmit(actor, decision, ctx),
        canApproveOrReject: canApproveOrReject(actor, decision, ctx),
      },
    };
  }

  @Post(':id/submit')
  async submit(@Param('id') id: string, @Body() body: ActorDto) {
    const decision = await this.prisma.pricingDecision.findUnique({
      where: { id },
    });
    if (!decision) throw new NotFoundException('Decision not found');

    const actor = await this.prisma.user.findUnique({
      where: { id: body.actorId },
    });
    if (!actor) throw new NotFoundException('Actor not found');

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
          actorId: body.actorId,
          comment: 'Submitted',
        },
      });
      return u;
    });

    return updated;
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body() body: ActorDto) {
    const decision = await this.prisma.pricingDecision.findUnique({
      where: { id },
    });
    if (!decision) throw new NotFoundException('Decision not found');

    const actor = await this.prisma.user.findUnique({
      where: { id: body.actorId },
    });
    if (!actor) throw new NotFoundException('Actor not found');

    const ctx = await this.accessCtx.build(actor, decision.yachtId);
    if (!canApproveOrReject(actor, decision, ctx))
      throw new ForbiddenException();

    const status = asDecisionStatus(decision.status);
    if (status !== DecisionStatus.SUBMITTED) {
      throw new ForbiddenException('Invalid source status');
    }

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
          actorId: body.actorId,
          comment: 'Approved',
        },
      });
      return u;
    });

    return updated;
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() body: RejectDto) {
    if (!body.comment?.trim()) {
      throw new ForbiddenException('Reject requires a comment');
    }

    const decision = await this.prisma.pricingDecision.findUnique({
      where: { id },
    });
    if (!decision) throw new NotFoundException('Decision not found');

    const actor = await this.prisma.user.findUnique({
      where: { id: body.actorId },
    });
    if (!actor) throw new NotFoundException('Actor not found');

    const ctx = await this.accessCtx.build(actor, decision.yachtId);
    if (!canApproveOrReject(actor, decision, ctx))
      throw new ForbiddenException();

    const status = asDecisionStatus(decision.status);
    if (status !== DecisionStatus.SUBMITTED) {
      throw new ForbiddenException('Invalid source status');
    }

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
          actorId: body.actorId,
          comment: body.comment,
        },
      });
      return u;
    });

    return updated;
  }
}
