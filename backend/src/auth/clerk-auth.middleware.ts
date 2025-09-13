// backend/src/auth/clerk-auth.middleware.ts
import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

// type JwtPayloadLite = { sub?: string } & Record<string, unknown>;

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

@Injectable()
export class ClerkAuthMiddleware implements NestMiddleware {
  private clerkClient: ClerkClient | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      const auth = req.headers.authorization ?? '';
      const [, token] = auth.split(' ');
      if (!token) throw new UnauthorizedException('Missing Bearer token');

      // Динамическая загрузка @clerk/backend (чтобы в fake-режиме пакет не требовался)
      const { createClerkClient, verifyToken } = (await import(
        '@clerk/backend'
      )) as ClerkBackendModule;

      if (!process.env.CLERK_SECRET_KEY) {
        throw new Error('CLERK_SECRET_KEY is not set');
      }

      if (!this.clerkClient) {
        this.clerkClient = createClerkClient({
          secretKey: process.env.CLERK_SECRET_KEY,
        });
      }
      const client = this.clerkClient;

      const verified = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        issuer: process.env.CLERK_ISSUER,
        audience: process.env.CLERK_AUDIENCE,
      });

      // Поддерживаем разные формы ответа SDK: {payload: {...}}, {sub: ...}, {claims: {sub: ...}}
      const isRec = (v: unknown): v is Record<string, unknown> =>
        typeof v === 'object' && v !== null;

      const extractSub = (v: unknown): string | null => {
        if (!isRec(v)) return null;

        const r = v;

        const p = r['payload'];
        if (isRec(p) && typeof p['sub'] === 'string') return p['sub'];

        if (typeof r['sub'] === 'string') return r['sub'];

        const c = r['claims'];
        if (isRec(c) && typeof c['sub'] === 'string') return c['sub'];

        return null;
      };

      const sub = extractSub(verified);
      const clerkUserId = sub ? String(sub) : '';
      if (!clerkUserId) {
        throw new UnauthorizedException('Invalid token: no sub');
      }

      const cUser = await client.users.getUser(clerkUserId);
      const email =
        cUser?.primaryEmailAddress?.emailAddress ??
        cUser?.emailAddresses?.[0]?.emailAddress ??
        null;

      if (!email) throw new UnauthorizedException('Email not found');

      const dbUser = await this.prisma.user.findFirst({ where: { email } });
      if (!dbUser) throw new UnauthorizedException('User not found in DB');

      req.user = dbUser;
      req.orgId = dbUser.orgId ?? null;

      next();
    } catch (e) {
      next(new UnauthorizedException((e as Error).message));
    }
  }
}
