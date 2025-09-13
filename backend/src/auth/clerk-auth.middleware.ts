// backend/src/auth/clerk-auth.middleware.ts
import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

type ClerkEmailAddr = { emailAddress?: string | null };
type ClerkUserLite = {
  id: string;
  primaryEmailAddress?: ClerkEmailAddr | null;
  emailAddresses?: ClerkEmailAddr[] | null;
};

interface ClerkClient {
  users: { getUser(id: string): Promise<ClerkUserLite> };
}

type ClerkBackendModule = {
  createClerkClient: (cfg: { secretKey: string }) => ClerkClient;
  verifyToken: (
    token: string,
    opts: {
      secretKey: string;
      issuer?: string | string[];
      audience?: string | string[];
    },
  ) => Promise<unknown>;
};

// ---- helpers ----
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

function extractSub(verified: unknown): string | null {
  if (!isRecord(verified)) return null;

  const payload = verified['payload'];
  if (isRecord(payload) && typeof payload['sub'] === 'string') {
    return payload['sub'];
  }

  if (typeof verified['sub'] === 'string') {
    return verified['sub'];
  }

  const claims = verified['claims'];
  if (isRecord(claims) && typeof claims['sub'] === 'string') {
    return claims['sub'];
  }

  return null;
}

@Injectable()
export class ClerkAuthMiddleware implements NestMiddleware {
  private clerkClient: ClerkClient | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      // Разрешаем health-check без токена
      const path = req.path ?? req.url ?? '';
      if (path === '/api/health' || path === '/health') return next();

      const auth = req.headers.authorization ?? '';
      const [, token] = auth.split(' ');
      if (!token) throw new UnauthorizedException('Missing Bearer token');

      // Динамически подгружаем SDK, чтобы в fake-режиме не тянуть зависимость
      const { createClerkClient, verifyToken } = (await import(
        '@clerk/backend'
      )) as ClerkBackendModule;

      const secretKey = process.env.CLERK_SECRET_KEY;
      if (!secretKey) throw new Error('CLERK_SECRET_KEY is not set');

      if (!this.clerkClient) {
        this.clerkClient = createClerkClient({ secretKey });
      }
      const client = this.clerkClient;

      const verified = await verifyToken(token, {
        secretKey,
        issuer: process.env.CLERK_ISSUER,
        audience: process.env.CLERK_AUDIENCE,
      });

      const sub = extractSub(verified);
      if (!sub) throw new UnauthorizedException('Invalid token: no sub');

      // Получаем email пользователя из Clerk
      const cUser = await client.users.getUser(sub);
      const email =
        cUser?.primaryEmailAddress?.emailAddress ??
        cUser?.emailAddresses?.[0]?.emailAddress ??
        null;
      if (!email) throw new UnauthorizedException('Email not found');

      // Маппим на пользователя в нашей БД
      const dbUser = await this.prisma.user.findFirst({
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
      if (!dbUser) throw new UnauthorizedException('User not found in DB');

      req.user = dbUser;
      req.orgId = dbUser.orgId ?? null;

      next();
    } catch (e) {
      next(new UnauthorizedException((e as Error).message));
    }
  }
}
