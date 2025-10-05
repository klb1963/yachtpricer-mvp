// frontend/src/pages/YachtEditPage.tsx

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type {
  Yacht,
  YachtUpdatePayload,
  Country,
  CatalogCategory,
  CatalogBuilder,
} from '../api';

import Select from 'react-select';
import AsyncSelect from 'react-select/async';
import {
  getYacht, updateYacht, createYacht, deleteYacht,
  getCountries, findCategories, findBuilders
} from '../api';

type YachtWithRefs = Yacht & {
  countryId?: string | null;
  country?: { id: string } | null;
  categoryId?: number | null;
  category?: { id: number } | null;
  builderId?: number | null;
  builder?: { id: number } | null;
};


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
  maxDiscountPct: string;       // вводим в процентах (строка формы)
  countryId: string;           // NEW
  categoryId: string;          // NEW (число в строке)
  builderId: string;           // NEW (число в строке)
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
  type Opt = { value: string; label: string };
  const [countryOpts, setCountryOpts] = useState<Opt[]>([]);

  const { t } = useTranslation('yacht');
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
    maxDiscountPct: '',
    countryId: '',
    categoryId: '',
    builderId: '', 
  });

  const [yacht, setYacht] = useState<Yacht | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load countries once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list: Country[] = await getCountries();
        if (cancelled) return;
        const opts = list
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => ({ value: c.id, label: `${c.name} (${c.code2})` }));
        setCountryOpts(opts);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isCreate) {
      setLoading(false);
      return;
    }
    if (!id) return;

    getYacht(id)
      .then((y: Yacht) => {
        setYacht(y);   // сохраняем оригинал для read-only полей

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

        const yy = y as YachtWithRefs;

        setForm({
          
          countryId: yy.countryId ?? yy.country?.id ?? '',
          categoryId:
            yy.categoryId != null ? String(yy.categoryId)
            : yy.category?.id != null ? String(yy.category.id)
            : '',
          builderId:
            yy.builderId != null ? String(yy.builderId)
            : yy.builder?.id != null ? String(yy.builder.id)
            : '',

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
          ownerName: y.ownerName ?? '',
          maxDiscountPct: y.maxDiscountPct != null ? String(y.maxDiscountPct) : '',
        });
      })
      .catch((e: unknown) =>
        setErr(e instanceof Error ? e.message : t('errors.loadFailed')),
      )
      .finally(() => setLoading(false));
  }, [id, isCreate, t]);

  const onChange =
    (name: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [name]: e.target.value }));
    };

  // ✅ Асинхронные загрузчики выносим вверх, чтобы не было нарушения правил хуков
  const loadCategoryOptions = useCallback(async (input: string) => {
    const { items }: { items: CatalogCategory[] } = await findCategories(input ?? '', 20);
    return items.map((c) => ({
      value: String(c.id),
      label: c.nameEn || c.nameRu || `#${c.id}`,
    }));
  }, []);

  const loadBuilderOptions = useCallback(async (input: string) => {
    const { items }: { items: CatalogBuilder[] } = await findBuilders(input ?? '', 20);
    return items.map((b) => ({
      value: String(b.id),
      label: b.name,
    }));
  }, []);

  // memoized current selected values for async selects
  const categoryValue = useMemo<Opt | null>(
    () => form.categoryId
      ? { value: form.categoryId, label: optionIdFallback(form.categoryId, 'category') }
      : null,
    [form.categoryId],
  );

  const builderValue = useMemo<Opt | null>(
    () => form.builderId
      ? { value: form.builderId, label: optionIdFallback(form.builderId, 'builder') }
      : null,
    [form.builderId],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      // ----- нормализация связей -----
      const countryId: string | null = form.countryId !== '' ? form.countryId : null;
      const categoryId: number | null =
        form.categoryId !== '' && Number.isFinite(Number(form.categoryId))
          ? Number(form.categoryId)
          : null;
      const builderId: number | null =
        form.builderId !== '' && Number.isFinite(Number(form.builderId))
          ? Number(form.builderId)
          : null;

      // ----- скидка -----
      let maxDiscountPct: number | null = null;
      if (form.maxDiscountPct !== '') {
        const n = Number(String(form.maxDiscountPct).replace(',', '.'));
        if (Number.isFinite(n)) maxDiscountPct = n;
      }

      // ----- услуги (может быть строкой или JSON-массивом) -----
      let currentExtraServices: YachtUpdatePayload['currentExtraServices'] | undefined =
        form.currentExtraServices;
      try {
        const parsed: unknown = JSON.parse(form.currentExtraServices);
        if (Array.isArray(parsed)) {
          currentExtraServices = parsed as Array<{ name: string; price: number }>;
        }
      } catch {
        // оставляем строковое значение как есть
      }

      // ----- итоговый payload без any -----
      const payload: YachtUpdatePayload = {
        name: form.name,
        manufacturer: form.manufacturer,
        model: form.model,
        type: form.type,
        location: form.location,
        fleet: form.fleet,
        charterCompany: form.charterCompany,
        // эти поля — строки по типам API
        length: form.length || undefined,
        builtYear: form.builtYear || undefined,
        cabins: form.cabins || undefined,
        heads: form.heads || undefined,
        basePrice: form.basePrice,
        currentExtraServices,
        ownerName: form.ownerName || undefined,
        maxDiscountPct,
        countryId,
        categoryId,
        builderId,
      };

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
      setErr(e instanceof Error ? e.message : t('errors.saveFailed', 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id) return;
    const ok = window.confirm(
      t('actions.deleteConfirm', { defaultValue: 'Delete "{{name}}"? This cannot be undone.', name: form.name || t('thisYacht', 'this yacht') })
    );
    if (!ok) return;

    try {
      setDeleting(true);
      await deleteYacht(id);
      nav('/dashboard');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('errors.deleteFailed', 'Failed to delete'));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="mt-10 text-center">{t('loading')}</div>;
  if (err) return <div className="mt-10 text-center text-red-600">{err}</div>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {isCreate ? t('actions.addYacht', 'Add yacht') : t('actions.editYacht', 'Edit yacht')}
        </h1>
        <Link to={id ? `/yacht/${id}` : '/dashboard'} className="text-blue-600 hover:underline">
          ← {t('actions.back')}
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <fieldset className="grid gap-4 rounded-2xl border p-5 md:grid-cols-2">
          <Legend>{t('sections.general', 'General')}</Legend>

          <Field label={t('fields.name', 'Name')} value={form.name} onChange={onChange('name')} />
          <Field label={t('fields.manufacturer')} value={form.manufacturer} onChange={onChange('manufacturer')} />
          <Field label={t('fields.model')} value={form.model} onChange={onChange('model')} />

          {/* Type */}
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">{t('fields.type')}</span>
            <select
              className="mt-1 rounded border p-2 bg-white"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="" disabled>{t('placeholders.chooseType', 'Choose type…')}</option>
              {TYPE_OPTIONS.map((tOpt) => (
                <option key={tOpt} value={tOpt}>{tOpt}</option>
              ))}
            </select>
          </label>

          <Field label={t('fields.location')} value={form.location} onChange={onChange('location')} />
          <Field label={t('fields.fleet')} value={form.fleet} onChange={onChange('fleet')} />
          <Field label={t('fields.company', 'Charter company')} value={form.charterCompany} onChange={onChange('charterCompany')} />
          <Field label={t('fields.owner', 'Owner name')} value={form.ownerName} onChange={onChange('ownerName')} />
          
          {/* Country (react-select, options загружаются один раз) */}
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">{t('fields.country', 'Country')}</span>
            <Select<Opt, false>
              className="mt-1"
              classNamePrefix="rs"
              options={countryOpts}
              isClearable
              value={
                form.countryId
                  ? countryOpts.find(o => o.value === form.countryId) ?? null
                  : null
              }
              onChange={(opt) =>
                setForm(f => ({ ...f, countryId: opt?.value ?? '' }))
              }
              placeholder={t('placeholders.chooseCountry', 'Choose country…')}
            />
          </label>

        </fieldset>

        <fieldset className="grid gap-4 rounded-2xl border p-5 md:grid-cols-2">
          <Legend>{t('sections.general', 'General')}</Legend>

          {/* Category (async) */}
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">{t('fields.category', 'Category')}</span>
            <AsyncSelect<Opt, false>
              className="mt-1"
              classNamePrefix="rs"
              cacheOptions
              defaultOptions

              loadOptions={loadCategoryOptions}

              isClearable
              
              value={categoryValue}
              
              onChange={(opt) =>
                setForm(f => ({ ...f, categoryId: opt?.value ?? '' }))
              }
              placeholder={t('placeholders.chooseCategory', 'Choose category…')}
            />
          </label>

          {/* Builder (async) */}
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">{t('fields.builder', 'Builder')}</span>
            <AsyncSelect<Opt, false>
              className="mt-1"
              classNamePrefix="rs"
              cacheOptions
              defaultOptions

              loadOptions={loadBuilderOptions}

              isClearable

              value={builderValue}

              onChange={(opt) =>
                setForm(f => ({ ...f, builderId: opt?.value ?? '' }))
              }
              placeholder={t('placeholders.chooseBuilder', 'Choose builder…')}
            />
          </label>
        </fieldset>

        <fieldset className="grid gap-4 rounded-2xl border p-5 md:grid-cols-3">
          <Legend>{t('sections.specs')}</Legend>

          {/* Length (feet) 5..100 */}
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">{t('fields.length')} (feet)</span>
            <select
              className="mt-1 rounded border p-2 bg-white"
              value={form.length}
              onChange={(e) => setForm((f) => ({ ...f, length: e.target.value }))}
            >
              <option value="" disabled>{t('placeholders.chooseLength', 'Choose length…')}</option>
              {LENGTH_OPTIONS.map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
          </label>

          {/* Built year 1990..current */}
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">{t('fields.built')}</span>
            <select
              className="mt-1 rounded border p-2 bg-white"
              value={form.builtYear}
              onChange={(e) => setForm((f) => ({ ...f, builtYear: e.target.value }))}
            >
              <option value="" disabled>{t('placeholders.chooseYear', 'Choose year…')}</option>
              {[...BUILT_YEAR_OPTIONS].reverse().map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </label>

          {/* Cabins 2..6 */}
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">{t('fields.cabins')}</span>
            <select
              className="mt-1 rounded border p-2 bg-white"
              value={form.cabins}
              onChange={(e) => setForm((f) => ({ ...f, cabins: e.target.value }))}
            >
              <option value="" disabled>{t('placeholders.chooseCabins', 'Choose cabins…')}</option>
              {CABINS_OPTIONS.map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
          </label>

          {/* Heads 1..4 */}
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">{t('fields.heads')}</span>
            <select
              className="mt-1 rounded border p-2 bg-white"
              value={form.heads}
              onChange={(e) => setForm((f) => ({ ...f, heads: e.target.value }))}
            >
              <option value="" disabled>{t('placeholders.chooseHeads', 'Choose heads…')}</option>
              {HEADS_OPTIONS.map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
          </label>

          <Field label={t('fields.basePrice')} value={form.basePrice} onChange={onChange('basePrice')} />
        </fieldset>

        {/* NEW: Pricing section */}
        <fieldset className="rounded-2xl border p-5">
          <Legend>{t('sections.pricing')}</Legend>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col">
              <span className="text-sm text-gray-600">{t('fields.maxDiscountPct')}</span>
              <input
                className="mt-1 rounded border p-2"
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                max="100"
                placeholder="—"
                value={form.maxDiscountPct}
                onChange={(e) => setForm(f => ({ ...f, maxDiscountPct: e.target.value }))}
              />
            </label>

            {/* read-only actuals for context (если пришли из API) */}
            <label className="flex flex-col">
              <span className="text-sm text-gray-600">{t('fields.actualPrice')}</span>
              <input
                className="mt-1 rounded border p-2 bg-gray-50"
                readOnly
                value={yacht?.actualPrice != null ? String(yacht.actualPrice) : '—'}
              />
            </label>

            <label className="flex flex-col">
              <span className="text-sm text-gray-600">{t('fields.actualDiscount')}</span>
              <input
                className="mt-1 rounded border p-2 bg-gray-50"
                readOnly
                value={yacht?.actualDiscountPct != null ? String(yacht.actualDiscountPct) + '%' : '—'}
              />
            </label>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            {t('fields.fetchedAt')}: {yacht?.fetchedAt ? new Date(yacht.fetchedAt).toLocaleString() : '—'}
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border p-5">
          <Legend>{t('sections.extraServices')}</Legend>
          <textarea
            className="mt-1 w-full rounded border p-2 font-mono text-sm"
            rows={6}
            value={form.currentExtraServices}
            onChange={onChange('currentExtraServices')}
          />
          <p className="mt-1 text-xs text-gray-500">
            {t('hints.extraServicesJsonHint', 'Можно оставить строкой — сервер сам сохранит.')}
          </p>
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
            {saving
              ? (isCreate ? t('actions.creating', 'Creating…') : t('actions.saving', 'Saving…'))
              : (isCreate ? t('actions.create', 'Create') : t('actions.save', 'Save'))}
          </button>

          <Link
            to={id ? `/yacht/${id}` : '/dashboard'}
            className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            {t('actions.cancel', 'Cancel')}
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
              title={t('actions.deleteTitle', 'Delete this yacht')}
            >
              {deleting ? t('actions.deleting', 'Deleting…') : t('actions.delete', 'Delete')}
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

// Небольшой fallback-лейбл, если редактируем уже выбранное значение,
// а асинхронные опции ещё не подгрузились — показываем #id
function optionIdFallback(id: string, kind: 'category' | 'builder'): string {
  if (!id) return '';
  if (kind === 'category') return `#${id}`;
  return `#${id}`;
}