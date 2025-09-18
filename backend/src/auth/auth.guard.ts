import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { User, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';

type ReqWithUser = Request & { user?: User | null };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Публичные маршруты пропускаем сразу
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<ReqWithUser>();
    const mode = process.env.AUTH_MODE === 'fake' ? 'fake' : 'clerk';

    if (mode === 'fake') {
      // Берём пользователя из заголовков-заглушек
      const email = req.header('X-User-Email');
      if (!email)
        throw new UnauthorizedException('Missing X-User-Email header');

      const roleHdr =
        (req.header('X-User-Role') as Role | undefined) ?? 'MANAGER';
      const orgIdHdr = req.header('X-User-OrgId') ?? null;

      // Найти/создать пользователя и синхронизировать роль/орг при необходимости
      let user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await this.prisma.user.create({
          data: { email, role: roleHdr, orgId: orgIdHdr },
        });
      } else if (user.role !== roleHdr || user.orgId !== orgIdHdr) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { role: roleHdr, orgId: orgIdHdr },
        });
      }

      req.user = user;
      return true;
    }

    // clerk/реальный режим — требуем Bearer
    const auth = req.header('authorization') || req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    // TODO: здесь вставь настоящую проверку токена и загрузку пользователя.
    // Пока просто пропускаем — но req.user останется undefined, и @CurrentUser будет null.
    // Когда подключишь верификацию — положи найденного пользователя в req.user.
    return true;
  }
}
