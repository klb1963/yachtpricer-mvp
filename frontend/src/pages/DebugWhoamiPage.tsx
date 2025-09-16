import { useEffect, useState } from "react";
import { api } from "@/api";

type Whoami =
  | { authenticated: false; mode: "clerk" | "fake" }
  | {
      authenticated: true;
      userId: string;
      email: string;
      orgId: string | null;
      role: "ADMIN" | "MANAGER" | "FLEET_MANAGER" | string;
      ownerMode: string | null;
      mode: "clerk" | "fake";
    };

export default function DebugWhoamiPage() {
  const [data, setData] = useState<Whoami | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tokenFirst16, setTokenFirst16] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      // покажем кусочек текущего токена, чтобы убедиться что он есть
      const token = await window.Clerk?.session?.getToken();
      setTokenFirst16(token ? token.slice(0, 16) : null);

      const res = await api.get<Whoami>("/auth/whoami");
      setData(res.data);
    } catch (e) {
      setErr((e as Error).message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const copyJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Debug: /auth/whoami</h1>

      <div className="mb-3 text-sm text-gray-600">
        Token (first 16):{" "}
        <code className="px-1 py-0.5 rounded bg-gray-100">
          {tokenFirst16 ?? "— no token —"}
        </code>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
        <button
          onClick={copyJSON}
          disabled={!data}
          className="px-3 py-1.5 rounded bg-gray-200"
        >
          Copy JSON
        </button>
      </div>

      {err ? (
        <div className="text-red-600">Error: {err}</div>
      ) : (
        <pre className="text-sm bg-gray-50 border rounded p-3 overflow-auto">
          {data ? JSON.stringify(data, null, 2) : "— no data —"}
        </pre>
      )}
    </div>
  );
}