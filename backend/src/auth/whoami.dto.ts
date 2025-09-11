export interface WhoAmIResponse {
  authenticated: boolean;
  orgId: string | null;
  user: {
    id: string;
    email: string;
    role: string;
    orgId: string | null;
    ownerMode: string | null;
    name: string | null;
  } | null;
}
