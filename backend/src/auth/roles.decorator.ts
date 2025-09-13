// backend/src/auth/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Принимает Prisma Role ИЛИ строковые литералы ('ADMIN' | 'MANAGER' ...),
 * чтобы не падали существующие места с @Roles('ADMIN', 'MANAGER').
 */
export const Roles = (...roles: ReadonlyArray<Role>) =>
  SetMetadata(ROLES_KEY, roles);
