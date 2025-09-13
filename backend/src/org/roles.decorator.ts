// backend/src/auth/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import type { $Enums } from '@prisma/client';

export const ROLES_KEY = 'roles';
export type Role = $Enums.Role;

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
