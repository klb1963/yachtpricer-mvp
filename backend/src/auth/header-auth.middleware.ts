import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/** Временная аутентификация по заголовку X-User-Email */
@Injectable()
export class HeaderAuthMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const email = req.header('X-User-Email')?.trim();
    if (!email) {
      req.user = null;
      return next();
    }
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      req.user = user ?? null;
    } catch {
      req.user = null;
    }
    next();
  }
}
