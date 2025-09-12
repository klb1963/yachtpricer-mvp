// backend/src/types/express.d.ts

import type { Role, User, ManagerYacht, OwnerYacht } from '@prisma/client';

export {};

declare module 'express-serve-static-core' {
  interface Request {
    // кто залогинен (поднимай из middleware)
    user?: User | null;

    // скоупы и предзагруженные связи
    orgId?: string | null;
    roles?: Role[];
    managerLinks?: ManagerYacht[];
    ownerLinks?: OwnerYacht[];

    // при желании можно добавить еще любые кэшированные поля
    // ownerMode?: User['ownerMode']; // если хочешь иметь быстрый доступ отдельно
  }
}
