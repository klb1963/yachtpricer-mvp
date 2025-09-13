// backend/src/auth/org-admin.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { Role } from '@prisma/client';

type ReqWithUser = Request & { user?: User | null };

@Injectable()
export class OrgAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<ReqWithUser>();

    const user = req.user;
    if (!user) throw new UnauthorizedException('Not authenticated');

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Admin only');
    }
    return true;
  }
}
