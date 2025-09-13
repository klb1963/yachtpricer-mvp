// backend/src/auth/header-auth.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/** Временная аутентификация по заголовку X-User-Email (fake-режим) */
@Injectable()
export class HeaderAuthMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // Пропускаем health без авторизации
    const path = req.path ?? req.url ?? '';
    if (path === '/api/health' || path === '/health') return next();

    const raw = req.header('x-user-email');
    const email = typeof raw === 'string' ? raw.trim() : '';
    if (!email) {
      req.user = null;
      req.orgId = null;
      return next();
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          orgId: true,
          role: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      req.user = user ?? null;
      req.orgId = user?.orgId ?? null;
      next();
    } catch {
      req.user = null;
      req.orgId = null;
      next();
    }
  }
}
