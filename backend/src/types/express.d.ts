import 'express';

type OrgRole = 'ADMIN' | 'FLEET_MANAGER' | 'OWNER' | 'MANAGER';

export interface OrgMembership {
  role: OrgRole;
  orgId: string;
  userId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    orgId?: string;
    membership?: OrgMembership;
    user?: { id: string; email?: string; role?: OrgRole }; // подправь под свой auth
  }
}
