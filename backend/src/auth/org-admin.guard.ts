// /backend/src/auth/org-admin.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express'; // важное добавление

@Injectable()
export class OrgAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    // Явно типизируем Request, где мы уже расширили поля в src/types/express.d.ts
    const req = ctx.switchToHttp().getRequest<Request>();

    const membership = req.membership; // теперь тип: OrgMembership | undefined
    if (!membership) throw new ForbiddenException('Not a member');
    if (membership.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return true;
  }
}
