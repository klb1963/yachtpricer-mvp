// backend/src/auth/roles.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { IS_PUBLIC_KEY } from './public.decorator'; // ← добавили
import type { Role, User } from '@prisma/client';
import type { Request } from 'express';

type ReqWithUser = Request & { user?: User | null };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // 🔑 проверяем публичный маршрут
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    // 👇 стандартная логика как была
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<ReqWithUser>();
    const user = req.user;
    if (!user) throw new UnauthorizedException('Not authenticated');

    const role = user.role;
    if (!role) throw new ForbiddenException('No role');

    if (role === 'ADMIN') return true;
    if (!required.includes(role))
      throw new ForbiddenException('Insufficient role');

    return true;
  }
}
