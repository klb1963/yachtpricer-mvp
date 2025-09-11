// backend/src/auth/org-admin.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';

@Injectable()
export class OrgAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();

    const user = req.user;
    if (!user) throw new ForbiddenException('No user');

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Admin only');
    }

    return true;
  }
}
