// backend/src/auth/current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User | null => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: User | null }>();
    return req.user ?? null;
  },
);
