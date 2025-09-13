// frontend/src/hooks/useWhoami.ts
import { useEffect, useState } from "react";
import { api } from "@/api";

type Role = "ADMIN" | "FLEET_MANAGER" | "MANAGER" | "OWNER";

export type WhoAmI =
  | {
      id: string;
      email: string;
      role: Role;
      orgId: string | null;
      name: string | null;
    }
  | null;

type WhoAmIWire = WhoAmI | { user: WhoAmI };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function pickUser(v: WhoAmIWire): WhoAmI {
  if (isRecord(v) && "user" in v && isRecord((v as Record<string, unknown>).user)) {
    return (v as { user: WhoAmI }).user;
  }
  return (v as WhoAmI) ?? null;
}

// Ждём появления window.Clerk и живой сессии (до ~5 сек)
async function waitForClerk(maxMs = 5000): Promise<void> {
  const start = Date.now();
  const w = window as unknown as { Clerk?: { session?: { getToken?: (o?: { skipCache?: boolean }) => Promise<string | null> } } };
  while (Date.now() - start < maxMs) {
    try {
      const t = await w.Clerk?.session?.getToken?.({ skipCache: true });
      if (t) return;
    } catch {
      // no-op, ещё подождём
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

// Безопасно получить токен Clerk (или null)
async function getClerkTokenSafe(): Promise<string | null> {
  const w = window as unknown as { Clerk?: { session?: { getToken?: (o?: { skipCache?: boolean }) => Promise<string | null> } } };
  try {
    return (await w.Clerk?.session?.getToken?.({ skipCache: true })) ?? null;
  } catch {
    return null;
  }
}

export function useWhoami() {
  const [data, setData] = useState<WhoAmI>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // 1) дождёмся Clerk
        await waitForClerk();

        // 2) попробуем достать токен и подставим его явно (вдобавок к интерсептору)
        const token = await getClerkTokenSafe();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const { data: json } = await api.get<WhoAmIWire>("/auth/whoami", { headers });
        const val = pickUser(json);

        if (!cancelled) setData(val);
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