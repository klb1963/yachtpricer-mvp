import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export type RoleName = 'ADMIN' | 'FLEET_MANAGER' | 'MANAGER' | 'OWNER';
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
