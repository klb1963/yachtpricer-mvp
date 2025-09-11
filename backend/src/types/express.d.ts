// backend/src/types/express.d.ts
import type { Role, User, ManagerYacht, OwnerYacht } from '@prisma/client';

export {};

declare module 'express-serve-static-core' {
  interface Request {
    user?: User | null;
    orgId?: string | null;
    roles?: Role[];
    managerLinks?: ManagerYacht[];
    ownerLinks?: OwnerYacht[];
  }
}
