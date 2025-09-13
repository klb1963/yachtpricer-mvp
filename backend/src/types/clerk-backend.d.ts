// backend/src/types/clerk-backend.d.ts

declare module '@clerk/backend' {
  export function verifyToken(
    token: string,
    options: {
      secretKey: string;
      issuer?: string | string[];
      audience?: string | string[];
    },
  ): Promise<{ payload: any }>;

  export function createClerkClient(config: { secretKey: string }): {
    users: { getUser(id: string): Promise<any> };
  };
}
