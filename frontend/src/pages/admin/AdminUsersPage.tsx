// /frontend/src/pages/admin/AdminUsersPage.tsx

import { useEffect, useMemo, useState } from "react";
import { buildHeaders } from "../../hooks/useWhoami";
type Role = "ADMIN" | "FLEET_MANAGER" | "MANAGER" | "OWNER";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  orgId: string | null;
  org?: { slug: string }; 
  createdAt?: string;
};

type ListResp = {
  items: UserRow[];
  total: number;
  page: number;
  limit: number;
};

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [data, setData] = useState<ListResp>({
    items: [],
    total: 0,
    page: 1,
    limit: 10,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [q, page, limit]);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const url = `/api/users?${params}`;
      const headers = buildHeaders();
      // диагностика — можно убрать, когда все ок
      console.log("AdminUsersPage.load ->", url, headers);

      const res = await fetch(url, { headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
      }
      const json = (await res.json()) as ListResp;
      setData(json);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load users");
      setData((d) => ({ ...d, items: [] })); // очистим список при ошибке
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const changeRole = async (userId: string, role: Role) => {
    try {
      const res = await fetch("/api/users/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...buildHeaders() },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      await load();
    } catch (e) {
      console.error(e);
      alert("Failed to update role");
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Users (Admin)</h1>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email or name…"
          className="border px-3 py-2 rounded w-72"
        />
        <button onClick={() => setPage(1)} className="px-4 py-2 rounded bg-black text-white">
          Apply
        </button>
        <button
          onClick={() => {
            setQ("");
            setPage(1);
          }}
          className="px-4 py-2 rounded bg-gray-200"
        >
          Reset
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-600">Rows:</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="border px-2 py-1 rounded"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="text-red-600 mb-2">Error: {err}</div>}

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Role</th>
                <th className="text-left p-2">Org</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.name ?? "—"}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">{u.org?.slug ?? "—"}</td>
                  <td className="p-2">
                    <select
                      defaultValue={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value as Role)}
                      className="border px-2 py-1 rounded"
                    >
                      {(["ADMIN", "FLEET_MANAGER", "MANAGER", "OWNER"] as Role[]).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-gray-500" colSpan={5}>
                    No users
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className={`px-3 py-1 rounded border ${page <= 1 ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          ◀ Prev
        </button>
        <span className="text-sm text-gray-600">
          Page {data.page} / {totalPages} • Total: {data.total}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className={`px-3 py-1 rounded border ${page >= totalPages ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          Next ▶
        </button>
      </div>
    </div>
  );
}
