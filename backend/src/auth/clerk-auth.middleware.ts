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
  firstName?: string | null;
  lastName?: string | null;
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

const ORG_SLUG = process.env.DEFAULT_ORG_SLUG ?? 'yachtpricer';
// необязательный белый список админов
const ADMIN_WHITELIST = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

@Injectable()
export class ClerkAuthMiddleware implements NestMiddleware {
  private clerkClient: ClerkClient | null = null;
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      const auth = req.headers.authorization ?? '';
      const [, token] = auth.split(' ');
      if (!token) throw new UnauthorizedException('Missing Bearer token');

      const { createClerkClient, verifyToken } = (await import(
        '@clerk/backend'
      )) as ClerkBackendModule;
      const secret = process.env.CLERK_SECRET_KEY;
      if (!secret) throw new Error('CLERK_SECRET_KEY is not set');

      if (!this.clerkClient) {
        this.clerkClient = createClerkClient({ secretKey: secret });
      }
      const client = this.clerkClient;

      const verified = await verifyToken(token, {
        secretKey: secret,
        issuer: process.env.CLERK_ISSUER,
        audience: process.env.CLERK_AUDIENCE,
      });

      const isRec = (v: unknown): v is Record<string, unknown> =>
        typeof v === 'object' && v !== null;
      const extractSub = (v: unknown): string | null => {
        if (!isRec(v)) return null;
        const p = isRec(v.payload) ? v.payload : null;
        if (p && typeof p['sub'] === 'string') return p['sub'];
        if (typeof v['sub'] === 'string') return v['sub'];
        const c = isRec(v['claims']) ? v['claims'] : null;
        if (c && typeof c['sub'] === 'string') return c['sub'];
        return null;
      };

      const sub = extractSub(verified);
      if (!sub) throw new UnauthorizedException('Invalid token: no sub');

      const cUser = await client.users.getUser(sub);
      const email =
        cUser?.primaryEmailAddress?.emailAddress ??
        cUser?.emailAddresses?.[0]?.emailAddress ??
        null;
      if (!email) throw new UnauthorizedException('Email not found');

      // --- Автопровижининг ---
      let dbUser = await this.prisma.user.findUnique({ where: { email } });
      if (!dbUser) {
        const org = await this.prisma.organization.upsert({
          where: { slug: ORG_SLUG },
          update: {},
          create: { slug: ORG_SLUG, name: ORG_SLUG },
        });

        // роль по умолчанию MANAGER; админам из whitelist — ADMIN
        const defaultRole = ADMIN_WHITELIST.includes(email.toLowerCase())
          ? 'ADMIN'
          : 'MANAGER';

        dbUser = await this.prisma.user.create({
          data: {
            email,
            name:
              [cUser.firstName, cUser.lastName].filter(Boolean).join(' ') ||
              null,
            role: defaultRole,
            org: { connect: { id: org.id } },
          },
        });
      }

      req.user = dbUser;
      req.orgId = dbUser.orgId ?? null;
      next();
    } catch (e) {
      next(new UnauthorizedException((e as Error).message));
    }
  }
}
