// backend/src/auth/access-ctx.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User, OwnerMode } from '@prisma/client';

export type AccessCtx = {
  isManagerOfYacht: boolean;
  isOwnerOfYacht: boolean;
  ownerMode?: OwnerMode; // enum, не строка
};

@Injectable()
export class AccessCtxService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    user: Pick<User, 'id' | 'role'>,
    yachtId: string,
  ): Promise<AccessCtx> {
    const [managerLink, ownerLink] = await Promise.all([
      this.prisma.managerYacht.findFirst({
        where: { managerId: user.id, yachtId },
      }),
      this.prisma.ownerYacht.findFirst({
        where: { ownerId: user.id, yachtId },
      }),
    ]);

    return {
      isManagerOfYacht: Boolean(managerLink),
      isOwnerOfYacht: Boolean(ownerLink),
      ownerMode: ownerLink?.mode,
    };
  }
}
