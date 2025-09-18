// backend/src/auth/clerk-auth.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
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
      authorizedParties?: string | string[];
    },
  ) => Promise<unknown>;
};

const ORG_SLUG = process.env.DEFAULT_ORG_SLUG ?? 'yachtpricer';
const ADMIN_WHITELIST = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

@Injectable()
export class ClerkAuthMiddleware implements NestMiddleware {
  private clerkClient: ClerkClient | null = null;
  private readonly log = new Logger(ClerkAuthMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      const auth = req.headers.authorization ?? '';
      const [, token] = auth.split(' ');
      if (!token) {
        this.log.debug('no Authorization header → skipping');
        return next(); // публичные ручки — пропускаем без юзера
      }

      this.log.debug(
        `received Authorization header, token length=${token.length}`,
      );

      const { createClerkClient, verifyToken } = (await import(
        '@clerk/backend'
      )) as ClerkBackendModule;

      const secret = process.env.CLERK_SECRET_KEY;
      if (!secret) throw new Error('CLERK_SECRET_KEY is not set');

      if (!this.clerkClient) {
        this.log.debug('initializing Clerk client…');
        this.clerkClient = createClerkClient({ secretKey: secret });
      }
      const client = this.clerkClient;

      const issuer = process.env.CLERK_JWT_ISSUER || process.env.CLERK_ISSUER;
      const audiences = (
        process.env.CLERK_JWT_AUDIENCE ||
        process.env.CLERK_AUDIENCE ||
        ''
      )
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      this.log.debug(
        `verify: issuer=${issuer}; audiences=[${audiences.join(', ')}]`,
      );

      const verified = await verifyToken(token, {
        secretKey: secret,
        issuer,
        audience: audiences.length ? audiences : undefined,
        authorizedParties: audiences.length ? audiences : undefined,
      });

      // извлекаем sub из verified
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
      if (!sub) {
        this.log.warn('Clerk token verified, but no sub claim');
        return next();
      }
      this.log.debug(`token OK, sub=${sub}`);

      this.log.debug('[Clerk] calling users.getUser(sub)…');
      const cUser = await client.users.getUser(sub);
      this.log.debug(
        `[Clerk] users.getUser → id=${cUser?.id ?? 'n/a'}, firstName=${
          cUser?.firstName ?? '-'
        }, lastName=${cUser?.lastName ?? '-'}`,
      );

      const email =
        cUser?.primaryEmailAddress?.emailAddress ??
        cUser?.emailAddresses?.[0]?.emailAddress ??
        null;

      this.log.debug(`[Clerk] resolved email=${email ?? 'null'}`);

      if (!email) {
        this.log.warn('Clerk user has no email; skipping auth');
        return next();
      }

      // автопровижининг
      let dbUser = await this.prisma.user.findUnique({ where: { email } });

      if (dbUser) {
        this.log.debug(
          `[DB] found existing user: id=${dbUser.id}, role=${dbUser.role}, org=${dbUser.orgId}`,
        );
      } else {
        this.log.debug(
          `[DB] user not found, provisioning new user with email=${email}`,
        );
        const org = await this.prisma.organization.upsert({
          where: { slug: ORG_SLUG },
          update: {},
          create: { slug: ORG_SLUG, name: ORG_SLUG },
        });
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
        this.log.debug(
          `[DB] new user created: id=${dbUser.id}, role=${dbUser.role}, org=${dbUser.orgId}`,
        );
      }

      req.user = dbUser;
      req.orgId = dbUser.orgId ?? null;
      this.log.debug(
        `[Clerk] req.user is set → id=${dbUser.id}, role=${dbUser.role}, org=${dbUser.orgId}`,
      );

      next();
    } catch (e) {
      this.log.warn(
        `Clerk auth middleware failed: ${(e as Error)?.message ?? e}`,
      );
      return next(); // не 401 — пусть guard решает доступ
    }
  }
}
