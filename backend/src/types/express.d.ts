// backend/src/types/express.d.ts
import 'express';
import type { User, Role, OwnerMode } from '@prisma/client';

export interface OrgMembership {
  role: Role; // Prisma enum
  orgId: string;
  userId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Организация из заголовков X-Org-Id / X-Org-Slug */
    orgId?: string | null;

    /** Необязательно, если используешь отдельные membership-и */
    membership?: OrgMembership;

    /**
     * Пользователь из базы (ставится HeaderAuthMiddleware).
     * Может быть null, если заголовка X-User-Email нет или юзер не найден.
     */
    user?: (User & { ownerMode?: OwnerMode | null }) | null;
  }
}

export {};
