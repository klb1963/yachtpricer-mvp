// /frontend/src/pages/OrganizationPage.tsx

import { useEffect, useMemo, useState } from "react";

type Org = {
  id: string;
  name: string;
  slug: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  websiteUrl?: string | null;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

export default function OrganizationPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [form, setForm] = useState<Partial<Org>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // ⚠️ Временная логика "кто Admin" (замени на свою /api/me, когда подключишь роли)
  const isAdmin = useMemo(() => {
    const role = window.localStorage.getItem("role") || "ADMIN"; // <-- пока по-умолчанию ADMIN
    return role.toUpperCase() === "ADMIN";
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await fetch("/api/org");
        if (!r.ok) throw new Error(await r.text());
        const data: Org = await r.json();
        setOrg(data);
        setForm({
          name: data.name,
          contactName: data.contactName || "",
          contactPhone: data.contactPhone || "",
          contactEmail: data.contactEmail || "",
          websiteUrl: data.websiteUrl || "",
        });
      } catch (e: unknown) {
        setError(getErrorMessage(e) || "Failed to load organization");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onChange =
    (k: keyof Org) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const onSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const r = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      const data: Org = await r.json();
      setOrg(data);
      setSaved(true);
    } catch (e: unknown) {
      setError(getErrorMessage(e) || "Save failed");
    } finally {
      setSaving(false);
      window.setTimeout(() => setSaved(false), 2000);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!org) return <div className="p-6">Organization not found</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Organization</h1>
        {!isAdmin ? (
          <span className="text-xs rounded px-2 py-1 bg-gray-100">
            read-only
          </span>
        ) : saved ? (
          <span className="text-xs rounded px-2 py-1 bg-green-100">
            Saved
          </span>
        ) : null}
      </div>

      <FormRow label="Name">
        {isAdmin ? (
          <input
            className="border rounded px-2 py-1 w-full"
            value={String(form.name ?? "")}
            onChange={onChange("name")}
          />
        ) : (
          <span>{org.name}</span>
        )}
      </FormRow>

      <FormRow label="Contact name">
        {isAdmin ? (
          <input
            className="border rounded px-2 py-1 w-full"
            value={String(form.contactName ?? "")}
            onChange={onChange("contactName")}
          />
        ) : (
          <span>{org.contactName || "—"}</span>
        )}
      </FormRow>

      <FormRow label="Phone">
        {isAdmin ? (
          <input
            className="border rounded px-2 py-1 w-full"
            value={String(form.contactPhone ?? "")}
            onChange={onChange("contactPhone")}
          />
        ) : (
          <span>{org.contactPhone || "—"}</span>
        )}
      </FormRow>

      <FormRow label="Email">
        {isAdmin ? (
          <input
            className="border rounded px-2 py-1 w-full"
            value={String(form.contactEmail ?? "")}
            onChange={onChange("contactEmail")}
          />
        ) : (
          <span>{org.contactEmail || "—"}</span>
        )}
      </FormRow>

      <FormRow label="Website">
        {isAdmin ? (
          <input
            className="border rounded px-2 py-1 w-full"
            value={String(form.websiteUrl ?? "")}
            onChange={onChange("websiteUrl")}
          />
        ) : org.websiteUrl ? (
          <a className="underline" href={org.websiteUrl} target="_blank" rel="noreferrer">
            {org.websiteUrl}
          </a>
        ) : (
          <span>—</span>
        )}
      </FormRow>

      {isAdmin && (
        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      )}
    </div>
  );
}

function FormRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-gray-600">{label}</span>
      {children}
    </label>
  );
}