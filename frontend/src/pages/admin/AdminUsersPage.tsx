// frontend/src/pages/admin/AdminUsersPage.tsx
import { useEffect, useMemo, useState } from "react";
import { api } from "@/api";

type Role = "ADMIN" | "FLEET_MANAGER" | "MANAGER" | "OWNER";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  orgId: string | null;
  org?: { slug: string };
  createdAt?: string;
  isActive: boolean;
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

  const params = useMemo(
    () => ({
      q: q.trim() || undefined,
      page,
      limit,
    }),
    [q, page, limit]
  );

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.get<ListResp>("/users", { params });
      setData(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load users");
      setData((d) => ({ ...d, items: [] }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const changeRole = async (userId: string, role: Role) => {
    try {
      await api.patch("/users/role", { userId, role });
      await load();
    } catch (e) {
      console.error(e);
      alert("Failed to update role");
    }
  };

  const toggleActive = async (userId: string, isActive: boolean) => {
    try {
      await api.patch("/users/active", { userId, isActive });
      await load();
    } catch (e) {
      console.error(e);
      alert("Failed to update user status");
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Users (Admin)</h1>

      <div className="mb-4">
        <a
          href="/debug/whoami"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          🔍 Open Debug /whoami
        </a>
      </div>

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
            setQ('')
            setPage(1)
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
              setLimit(Number(e.target.value))
              setPage(1)
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
                <tr
                  key={u.id}
                  className={`border-t ${u.isActive ? "" : "opacity-60 bg-gray-50"}`}
                >
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.name ?? '—'}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">{u.org?.slug ?? '—'}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <select
                        defaultValue={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value as Role)}
                        className="border px-2 py-1 rounded"
                      >
                        {(['ADMIN', 'FLEET_MANAGER', 'MANAGER', 'OWNER'] as Role[]).map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => toggleActive(u.id, !u.isActive)}
                        className={`px-3 py-1 rounded text-xs font-semibold border ${
                          u.isActive
                            ? "bg-green-100 text-green-800 border-green-300"
                            : "bg-gray-200 text-gray-700 border-gray-300"
                        }`}
                        title={u.isActive ? "Deactivate user" : "Activate user"}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </button>
                    </div>
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
          className={`px-3 py-1 rounded border ${page <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          ◀ Prev
        </button>
        <span className="text-sm text-gray-600">
          Page {data.page} / {totalPages} • Total: {data.total}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className={`px-3 py-1 rounded border ${page >= totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Next ▶
        </button>
      </div>
    </div>
  )
}