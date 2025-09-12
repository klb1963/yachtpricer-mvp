// backend/src/auth/roles.enum.ts

export enum Role {
  ADMIN = 'ADMIN',
  FLEET_MANAGER = 'FLEET_MANAGER',
  MANAGER = 'MANAGER',
  OWNER = 'OWNER',
}

export enum OwnerMode {
  ACTIVE = 'ACTIVE',
  VIEW_ONLY = 'VIEW_ONLY',
  HIDDEN = 'HIDDEN',
}
