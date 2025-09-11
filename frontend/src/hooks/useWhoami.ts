// frontend/src/hooks/useWhoami.ts
import { useEffect, useState } from "react";

type WhoAmI = {
    id: string;
    email: string;
    role: "ADMIN" | "FLEET_MANAGER" | "MANAGER" | "OWNER";
    orgId: string | null;
    name: string | null;
} | null;

// buildHeaders.ts
export function buildHeaders(): HeadersInit {
    const devEmail = localStorage.getItem("devUserEmail") ?? undefined;
    const headers: Record<string, string> = {};
    if (devEmail) headers["X-User-Email"] = devEmail; // добавляем только если есть
    return headers;
}

export function useWhoami() {
    const [data, setData] = useState<WhoAmI>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {

        console.log('useWhoami: fetching', buildHeaders());
        
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await fetch("/api/auth/whoami", { headers: buildHeaders() });
                const json = await res.json();
                if (!cancelled) setData(json?.user ?? json ?? null);
            } catch {
                if (!cancelled) setData(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return { whoami: data, loading };
}
