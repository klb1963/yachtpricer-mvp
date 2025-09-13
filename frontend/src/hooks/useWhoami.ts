// frontend/src/hooks/useWhoami.ts

import { useEffect, useState } from "react";
// без алиаса используем относительный импорт
import { api } from "../api";

export type WhoAmI =
  | {
      id: string;
      email: string;
      role: "ADMIN" | "FLEET_MANAGER" | "MANAGER" | "OWNER";
      orgId: string | null;
      name: string | null;
    }
  | null;

type WhoAmIRaw = {
  authenticated: boolean;
  userId?: string;
  email?: string;
  role?: "ADMIN" | "FLEET_MANAGER" | "MANAGER" | "OWNER";
  orgId?: string | null;
  name?: string | null;
  mode?: "fake" | "clerk";
};

export function buildHeaders(): Record<string, string> {
  const devEmail = localStorage.getItem("devUserEmail") ?? undefined;
  return devEmail ? { "X-User-Email": devEmail } : {};
}

export function useWhoami() {
  const [data, setData] = useState<WhoAmI>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data: raw } = await api.get<WhoAmIRaw>("/auth/whoami", {
          headers: buildHeaders(),
        });

        const mapped: WhoAmI =
          raw?.authenticated && raw.userId && raw.email
            ? {
                id: raw.userId,
                email: raw.email,
                role: raw.role ?? "MANAGER",
                orgId: raw.orgId ?? null,
                name: raw.name ?? null,
              }
            : null;

        if (!cancelled) setData(mapped);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { whoami: data, loading };
}

export default useWhoami;