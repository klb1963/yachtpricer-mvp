// backend/src/auth/access-ctx.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User, OwnerMode } from '@prisma/client';

export type AccessCtx = {
  isManagerOfYacht: boolean;
  isOwnerOfYacht: boolean;
  ownerMode?: OwnerMode | null;
  sameOrg: boolean; // пользователь и яхта в одной организации
  yachtOrgId: string | null;
  userOrgId: string | null;
};

@Injectable()
export class AccessCtxService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    user: Pick<User, 'id' | 'role' | 'orgId'>,
    yachtId: string,
  ): Promise<AccessCtx> {
    // связи "менеджер ↔ яхта" и "владелец ↔ яхта"
    const [managerLink, ownerLink, yacht] = await Promise.all([
      this.prisma.managerYacht.findFirst({
        where: { managerId: user.id, yachtId },
      }),
      this.prisma.ownerYacht.findFirst({
        where: { ownerId: user.id, yachtId },
      }),
      this.prisma.yacht.findUnique({
        where: { id: yachtId },
        select: { orgId: true },
      }),
    ]);

    const yachtOrgId = yacht?.orgId ?? null;
    const userOrgId = user.orgId ?? null;

    return {
      isManagerOfYacht: Boolean(managerLink),
      isOwnerOfYacht: Boolean(ownerLink),
      ownerMode: ownerLink?.mode ?? null,
      sameOrg: !!yachtOrgId && !!userOrgId && yachtOrgId === userOrgId,
      yachtOrgId,
      userOrgId,
    };
  }
}
