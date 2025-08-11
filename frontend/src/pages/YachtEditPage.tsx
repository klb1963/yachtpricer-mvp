// frontend/src/pages/YachtEditPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getYacht, updateYacht, createYacht, deleteYacht } from '../api';
import type { Yacht, YachtUpdatePayload } from '../api';

type FormState = {
  name: string;
  manufacturer: string;
  model: string;
  type: string;
  location: string;
  fleet: string;
  charterCompany: string;
  length: string;              // значения в форме как строки
  builtYear: string;
  cabins: string;
  heads: string;
  basePrice: string;
  currentExtraServices: string; // текст (может быть JSON)
  ownerName: string;
};

const TYPE_OPTIONS = ['monohull', 'catamaran', 'trimaran', 'compromis'] as const;
type TypeOption = (typeof TYPE_OPTIONS)[number];

function isTypeOption(val: string | null | undefined): val is TypeOption {
  return !!val && TYPE_OPTIONS.includes(val as TypeOption);
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const CURRENT_YEAR = new Date().getFullYear();
const LENGTH_OPTIONS = range(5, 100);      // feet
const BUILT_YEAR_OPTIONS = range(1990, CURRENT_YEAR);
const CABINS_OPTIONS = range(2, 6);
const HEADS_OPTIONS = range(1, 4);

export default function YachtEditPage() {
  const { id } = useParams();
  const isCreate = !id;
  const nav = useNavigate();

  const [form, setForm] = useState<FormState>({
    name: '',
    manufacturer: '',
    model: '',
    type: '',
    location: '',
    fleet: '',
    charterCompany: '',
    length: '',
    builtYear: '',
    cabins: '',
    heads: '',
    basePrice: '',
    currentExtraServices: '',
    ownerName: '',
  });

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isCreate) {
      setLoading(false);
      return;
    }
    if (!id) return;

    getYacht(id)
      .then((y: Yacht) => {
        const basePriceStr =
          typeof y.basePrice === 'string'
            ? y.basePrice
            : y.basePrice != null
            ? String(y.basePrice)
            : '';

        const extraStr =
          typeof y.currentExtraServices === 'string'
            ? y.currentExtraServices
            : JSON.stringify(y.currentExtraServices ?? [], null, 2);

        setForm({
          name: y.name ?? '',
          manufacturer: y.manufacturer ?? '',
          model: y.model ?? '',
          type: isTypeOption(y.type) ? y.type : '',
          location: y.location ?? '',
          fleet: y.fleet ?? '',
          charterCompany: y.charterCompany ?? '',
          length: y.length != null ? String(y.length) : '',
          builtYear: y.builtYear != null ? String(y.builtYear) : '',
          cabins: y.cabins != null ? String(y.cabins) : '',
          heads: y.heads != null ? String(y.heads) : '',
          basePrice: basePriceStr,
          currentExtraServices: extraStr,
          ownerName: y.ownerName ?? '', // свойство есть в API
        });
      })
      .catch((e: unknown) =>
        setErr(e instanceof Error ? e.message : 'Failed to load'),
      )
      .finally(() => setLoading(false));
  }, [id, isCreate]);

  const onChange =
    (name: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [name]: e.target.value }));
    };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const payload: YachtUpdatePayload = { ...form };

      // Попробуем распарсить services как JSON‑массив вида [{name, price}]
      try {
        const parsed: unknown = JSON.parse(form.currentExtraServices);
        if (Array.isArray(parsed)) {
          payload.currentExtraServices = parsed as Array<{ name: string; price: number }>;
        }
      } catch {
        // оставим строкой — корректно
      }

      if (isCreate) {
        // на бэке поле обязательно — если пусто, шлём []
        if (
          payload.currentExtraServices === undefined ||
          payload.currentExtraServices === ''
        ) {
          payload.currentExtraServices = [];
        }
        const created = await createYacht(payload);
        nav(`/yacht/${created.id}`);
      } else if (id) {
        await updateYacht(id, payload);
        nav(`/yacht/${id}`);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id) return;
    const ok = window.confirm(
      `Delete "${form.name || 'this yacht'}"? This cannot be undone.`
    );
    if (!ok) return;

    try {
      setDeleting(true);
      await deleteYacht(id);
      nav('/dashboard');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="mt-10 text-center">Loading…</div>;
  if (err) return <div className="mt-10 text-center text-red-600">{err}</div>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isCreate ? 'Add yacht' : 'Edit yacht'}</h1>
        <Link to={id ? `/yacht/${id}` : '/dashboard'} className="text-blue-600 hover:underline">
          ← Back
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <fieldset className="grid gap-4 rounded-2xl border p-5 md:grid-cols-2">
          <Legend>General</Legend>

          <Field label="Name" value={form.name} onChange={onChange('name')} />
          <Field label="Manufacturer" value={form.manufacturer} onChange={onChange('manufacturer')} />
          <Field label="Model" value={form.model} onChange={onChange('model')} />

          {/* Type */}
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Type</span>
            <select
              className="mt-1 rounded border p-2 bg-white"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="" disabled>Choose type…</option>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <Field label="Location" value={form.location} onChange={onChange('location')} />
          <Field label="Fleet" value={form.fleet} onChange={onChange('fleet')} />
          <Field label="Charter company" value={form.charterCompany} onChange={onChange('charterCompany')} />
          <Field label="Owner name" value={form.ownerName} onChange={onChange('ownerName')} />
        </fieldset>

        <fieldset className="grid gap-4 rounded-2xl border p-5 md:grid-cols-3">
          <Legend>Specs</Legend>

          {/* Length (feet) 5..100 */}
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Length (feet)</span>
            <select
              className="mt-1 rounded border p-2 bg-white"
              value={form.length}
              onChange={(e) => setForm((f) => ({ ...f, length: e.target.value }))}
            >
              <option value="" disabled>Choose length…</option>
              {LENGTH_OPTIONS.map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
          </label>

          {/* Built year 1990..current */}
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Built year</span>
            <select
              className="mt-1 rounded border p-2 bg-white"
              value={form.builtYear}
              onChange={(e) => setForm((f) => ({ ...f, builtYear: e.target.value }))}
            >
              <option value="" disabled>Choose year…</option>
              {[...BUILT_YEAR_OPTIONS].reverse().map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </label>

          {/* Cabins 2..6 */}
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Cabins</span>
            <select
              className="mt-1 rounded border p-2 bg-white"
              value={form.cabins}
              onChange={(e) => setForm((f) => ({ ...f, cabins: e.target.value }))}
            >
              <option value="" disabled>Choose cabins…</option>
              {CABINS_OPTIONS.map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
          </label>

          {/* Heads 1..4 */}
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Heads</span>
            <select
              className="mt-1 rounded border p-2 bg-white"
              value={form.heads}
              onChange={(e) => setForm((f) => ({ ...f, heads: e.target.value }))}
            >
              <option value="" disabled>Choose heads…</option>
              {HEADS_OPTIONS.map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
          </label>

          <Field label="Base price" value={form.basePrice} onChange={onChange('basePrice')} />
        </fieldset>

        <fieldset className="rounded-2xl border p-5">
          <Legend>Extra services (JSON)</Legend>
          <textarea
            className="mt-1 w/full rounded border p-2 font-mono text-sm"
            rows={6}
            value={form.currentExtraServices}
            onChange={onChange('currentExtraServices')}
          />
          <p className="mt-1 text-xs text-gray-500">Можно оставить строкой — сервер сам сохранит.</p>
        </fieldset>

        <div className="flex gap-3 items-center">
          <button
            type="submit"
            disabled={saving || deleting}
            className="inline-flex items-center justify-center rounded-xl px-5 py-2.5
                       font-semibold text-white shadow-sm
                       bg-blue-600 hover:bg-blue-700
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                       disabled:bg-blue-400 disabled:text-white disabled:opacity-100 disabled:cursor-not-allowed"
          >
            {saving ? (isCreate ? 'Creating…' : 'Saving…') : (isCreate ? 'Create' : 'Save')}
          </button>

          <Link
            to={id ? `/yacht/${id}` : '/dashboard'}
            className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            Cancel
          </Link>

          {!isCreate && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting || saving}
              className="ml-auto inline-flex items-center justify-center rounded-xl px-4 py-2
                         font-semibold text-white shadow-sm
                         bg-red-600 hover:bg-red-700
                         focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
                         disabled:opacity-60"
              title="Delete this yacht"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex flex-col">
      <span className="text-sm text-gray-600">{props.label}</span>
      <input className="mt-1 rounded border p-2" value={props.value} onChange={props.onChange} />
    </label>
  );
}

function Legend({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 font-semibold col-span-full">{children}</div>;
}