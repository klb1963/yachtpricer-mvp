// frontend/src/components/yacht/YachtEditForm.tsx

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type {
    Yacht,
    YachtUpdatePayload,
    Country,
    CatalogCategory,
    CatalogBuilder,
    CatalogModel,
} from '../../api';

import Select from 'react-select';
import AsyncSelect from 'react-select/async';
import {
    getYacht,
    updateYacht,
    createYacht,
    deleteYacht,
    getCountries,
    findCategories,
    findBuilders,
    findModels,
    api,
} from '../../api';
import { Field } from '../form/Field';
import { Legend } from '../form/Legend';
import { ResponsibleManagerSelect } from './sections/ResponsibleManagerSelect';
import { YachtSpecsSection } from './sections/YachtSpecsSection';
import { YachtPricingSection } from './sections/YachtPricingSection';
import { YachtExtraServicesSection } from './sections/YachtExtraServicesSection';

// ---- типы и константы ----

type YachtWithRefs = Yacht & {
    countryId?: string | null;
    country?: { id: string } | null;
    categoryId?: number | null;
    category?: { id: number; nameEn?: string | null; nameRu?: string | null } | null;
    builderId?: number | null;
    builder?: { id: number; name: string } | null;
};

type FormState = {
    name: string;
    manufacturer: string;
    model: string;
    type: string;
    location: string;
    fleet: string;
    charterCompany: string;
    length: string;
    builtYear: string;
    cabins: string;
    heads: string;
    basePrice: string;
    currentExtraServices: string;
    ownerName: string;
    maxDiscountPct: string;
    countryId: string;
    categoryId: string;
    builderId: string;
    responsibleManagerId: string;
    nausysId: string;
};

const TYPE_OPTIONS = ['monohull', 'catamaran', 'trimaran', 'compromis'] as const;
type TypeOption = (typeof TYPE_OPTIONS)[number];

function isTypeOption(val: string | null | undefined): val is TypeOption {
    return !!val && TYPE_OPTIONS.includes(val as TypeOption);
}

const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

const CURRENT_YEAR = new Date().getFullYear();
const LENGTH_OPTIONS = range(5, 100);
const BUILT_YEAR_OPTIONS = range(1990, CURRENT_YEAR + 2);
const CABINS_OPTIONS = range(2, 12);
const HEADS_OPTIONS = range(1, 12);

type Opt = { value: string; label: string };

type Props = {
    yachtId?: string | null;
};

// ---- компонент формы ----

export default function YachtEditForm({ yachtId }: Props) {
    const id = yachtId ?? undefined;
    const isCreate = !id;
    const nav = useNavigate();
    const { t, i18n } = useTranslation('yacht');

    const [categoryLabel, setCategoryLabel] = useState<string | null>(null);
    const [builderLabel, setBuilderLabel] = useState<string | null>(null);
    const [modelLabel, setModelLabel] = useState<string | null>(null);

    const [countryOpts, setCountryOpts] = useState<Opt[]>([]);

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
        responsibleManagerId: '',
        nausysId: '', 
    });

    const [yacht, setYacht] = useState<Yacht | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<
        Partial<Record<keyof FormState, string>>
    >({});
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // выбор локализованных названий категорий
    const pickLocalizedName = useCallback(
        (obj: { id: number; nameEn?: string | null; nameRu?: string | null; nameHr?: string | null }) => {
            const lng = (i18n.language || 'en').toLowerCase();
            const tryOrder = lng.startsWith('ru')
                ? ['nameRu', 'nameEn', 'nameHr']
                : lng.startsWith('hr')
                    ? ['nameHr', 'nameEn', 'nameRu']
                    : ['nameEn', 'nameRu', 'nameHr'];
            const first = tryOrder
                .map((k) => (obj as any)[k] as string | null | undefined)
                .find(Boolean);
            return first ?? `#${obj.id}`;
        },
        [i18n.language],
    );

    // страны
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
            } catch {
                /* noop */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // загрузка яхты
    useEffect(() => {
        if (isCreate) {
            setLoading(false);
            return;
        }
        if (!id) return;

        getYacht(id)
            .then((y: Yacht) => {
                setYacht(y);

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

                const yy: YachtWithRefs = y as YachtWithRefs;

                setCategoryLabel(
                    yy.category?.id != null ? pickLocalizedName(yy.category as any) : null,
                );
                setBuilderLabel(
                    yy.builder?.id != null ? yy.builder.name || `#${yy.builder.id}` : null,
                );
                setModelLabel(y.model ?? null);

                setForm({
                    countryId: yy.countryId ?? yy.country?.id ?? '',
                    categoryId:
                        yy.categoryId != null
                            ? String(yy.categoryId)
                            : yy.category?.id != null
                                ? String(yy.category.id)
                                : '',
                    builderId:
                        yy.builderId != null
                            ? String(yy.builderId)
                            : yy.builder?.id != null
                                ? String(yy.builder.id)
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
                    responsibleManagerId:
                        (y as any).responsibleManagerId != null
                            ? String((y as any).responsibleManagerId)
                            : '',
                    nausysId: (y as any).nausysId ?? '', 
                });
            })
            .catch((e: unknown) =>
                setErr(e instanceof Error ? e.message : t('errors.loadFailed')),
            )
            .finally(() => setLoading(false));
    }, [id, isCreate, t, pickLocalizedName]);

    const onChange =
        (name: keyof FormState) =>
            (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                setForm((f) => ({ ...f, [name]: e.target.value }));
            };

    const selectedCountry = useMemo<Opt | null>(() => {
        if (!form.countryId) return null;
        return countryOpts.find((o) => o.value === form.countryId) ?? null;
    }, [countryOpts, form.countryId]);

    const loadCategoryOptions = useCallback(
        async (input: string) => {
            const { items }: { items: CatalogCategory[] } = await findCategories(
                input ?? '',
                20,
            );
            return items.map((c) => ({
                value: String(c.id),
                label: pickLocalizedName(c as any),
            }));
        },
        [pickLocalizedName],
    );

    const loadBuilderOptions = useCallback(async (input: string) => {
        const { items }: { items: CatalogBuilder[] } = await findBuilders(
            input ?? '',
            20,
        );
        return items.map((b) => ({
            value: String(b.id),
            label: b.name,
        }));
    }, []);

    const loadModelOptions = useCallback(
        async (input: string) => {
            const opts: { take?: number; builderId?: number } = { take: 20 };
            const bid = Number(form.builderId);
            if (Number.isFinite(bid)) opts.builderId = bid;
            const { items }: { items: CatalogModel[] } = await findModels(
                input ?? '',
                opts,
            );
            return items.map((m) => ({
                value: m.name,
                label: m.name,
            }));
        },
        [form.builderId],
    );

    const categoryValue = useMemo<Opt | null>(() => {
        if (!form.categoryId) return null;
        if (!categoryLabel) return null;
        return { value: form.categoryId, label: categoryLabel };
    }, [form.categoryId, categoryLabel]);

    const builderValue = useMemo<Opt | null>(() => {
        if (!form.builderId) return null;
        if (!builderLabel) return null;
        return { value: form.builderId, label: builderLabel };
    }, [form.builderId, builderLabel]);

    const modelValue = useMemo<Opt | null>(() => {
        if (!form.model) return null;
        return { value: form.model, label: modelLabel ?? form.model };
    }, [form.model, modelLabel]);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);

        // При создании яхты Max discount % — обязательное поле
        if (isCreate) {
            const raw = form.maxDiscountPct.trim();
            const n = Number(raw.replace(',', '.'));
            if (!raw || !Number.isFinite(n)) {
                alert(
                    t(
                        'errors.maxDiscountRequired',
                        'Please specify maximum discount (%) when creating a yacht.',
                    ),
                );
                return;
            }
        }

        setSaving(true);
        try {
            const countryId: string | null =
                form.countryId !== '' ? form.countryId : null;
            const categoryId: number | null =
                form.categoryId !== '' && Number.isFinite(Number(form.categoryId))
                    ? Number(form.categoryId)
                    : null;
            const builderId: number | null =
                form.builderId !== '' && Number.isFinite(Number(form.builderId))
                    ? Number(form.builderId)
                    : null;

            const responsibleManagerId: string | null =
                form.responsibleManagerId.trim() !== ''
                    ? form.responsibleManagerId.trim()
                    : null;

            let maxDiscountPct: number | null = null;
            if (form.maxDiscountPct !== '') {
                const n = Number(String(form.maxDiscountPct).replace(',', '.'));
                if (Number.isFinite(n)) maxDiscountPct = n;
            }

            let currentExtraServices: YachtUpdatePayload['currentExtraServices'] | undefined =
                form.currentExtraServices;
            try {
                const parsed: unknown = JSON.parse(form.currentExtraServices);
                if (Array.isArray(parsed)) {
                    currentExtraServices = parsed as Array<{ name: string; price: number }>;
                }
            } catch {
                // оставляем строку как есть
            }

            const payload: YachtUpdatePayload = {
                name: form.name,
                manufacturer: form.manufacturer,
                model: form.model,
                type: form.type,
                location: form.location,
                fleet: form.fleet,
                charterCompany: form.charterCompany,
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
                responsibleManagerId,
                nausysId: form.nausysId.trim() || undefined, 
            };

            if (isCreate) {
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
            const anyErr = e as any;
            const fallback = t('errors.saveFailed', 'Failed to save');

            // Пытаемся вытащить payload от NestJS / Axios
            const resp = anyErr?.response?.data ?? anyErr?.response;
            const rawMessage = resp?.message ?? resp;

            let messageKey: string | undefined;
            let field: string | undefined;

            if (rawMessage && typeof rawMessage === 'object') {
                messageKey =
                    (rawMessage as any).messageKey ??
                    (rawMessage as any).message_key;
                field = (rawMessage as any).field;
            } else if (resp && typeof resp === 'object') {
                messageKey =
                    (resp as any).messageKey ?? (resp as any).message_key;
                field = (resp as any).field;
            }

            if (messageKey && typeof messageKey === 'string') {
                const translated = t(messageKey);

                if (field && field in form) {
                    setFieldErrors((prev) => ({
                        ...prev,
                        [field as keyof FormState]: translated,
                    }));
                } else {
                    setErr(translated);
                }
                return;
            }

            if (typeof rawMessage === 'string') {
                setErr(rawMessage);
                return;
            }

            if (anyErr instanceof Error && anyErr.message) {
                setErr(anyErr.message);
                return;
            }

            setErr(fallback);
        } finally {
            setSaving(false);
        }
    }

    async function onDelete() {
        if (!id) return;
        const ok = window.confirm(
            t('actions.deleteConfirm', {
                defaultValue: 'Delete "{{name}}"? This cannot be undone.',
                name: form.name || t('thisYacht', 'this yacht'),
            }),
        );
        if (!ok) return;

        try {
            setDeleting(true);
            await deleteYacht(id);
            nav('/dashboard');
        } catch (e: unknown) {
            setErr(
                e instanceof Error
                    ? e.message
                    : t('errors.deleteFailed', 'Failed to delete'),
            );
        } finally {
            setDeleting(false);
        }
    }

    if (loading) return <div className="mt-10 text-center">{t('loading')}</div>;

    const canEditManager = true;

    return (
        <div className="mx-auto max-w-3xl p-6">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold">
                    {isCreate
                        ? t('actions.addYacht', 'Add yacht')
                        : t('actions.editYacht', 'Edit yacht')}
                </h1>
                <Link
                    to={id ? `/yacht/${id}` : '/dashboard'}
                    className="text-blue-600 hover:underline"
                >
                    ← {t('actions.back')}
                </Link>
            </div>

            {err && (
                <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 text-center">
                    {err}
                </div>
            )}

            <form onSubmit={onSubmit} className="space-y-6">
                <fieldset className="grid gap-4 rounded-2xl border p-5 md:grid-cols-2">
                    <div>
                        {canEditManager && (
                            <ResponsibleManagerSelect
                                value={form.responsibleManagerId}
                                onChange={(v) =>
                                    setForm((f) => ({
                                        ...f,
                                        responsibleManagerId: v,
                                    }))
                                }
                            />
                        )}
                    </div>

                    <Legend>{t('sections.general', 'General')}</Legend>

                    <div>
                        <Field
                            label={t('fields.name', 'Name')}
                            value={form.name}
                            onChange={onChange('name')}
                        />
                        {fieldErrors.name && (
                            <p className="mt-1 text-xs text-red-600">
                                {fieldErrors.name}
                            </p>
                        )}
                    </div>

                    <div>
                        <Field
                            label={t('fields.fleet')}
                            value={form.fleet}
                            onChange={onChange('fleet')}
                        />
                        {fieldErrors.fleet && (
                            <p className="mt-1 text-xs text-red-600">
                                {fieldErrors.fleet}
                            </p>
                        )}
                    </div>

                    <div>
                        <Field
                            label={t('fields.company', 'Charter company')}
                            value={form.charterCompany}
                            onChange={onChange('charterCompany')}
                        />
                        {fieldErrors.charterCompany && (
                            <p className="mt-1 text-xs text-red-600">
                                {fieldErrors.charterCompany}
                            </p>
                        )}
                    </div>

                    <Field
                        label={t('fields.owner', 'Owner name')}
                        value={form.ownerName}
                        onChange={onChange('ownerName')}
                    />

                    <label className="flex flex-col">
                        <span className="text-sm text-gray-600">
                            {t('fields.country', 'Country')}
                        </span>
                        <Select<Opt, false>
                            className="mt-1"
                            classNamePrefix="rs"
                            options={countryOpts}
                            isClearable
                            value={selectedCountry}
                            onChange={(opt) => {
                                const v = opt?.value ?? '';
                                setForm((f) => ({ ...f, countryId: v }));
                            }}
                            getOptionValue={(o) => o.value}
                            getOptionLabel={(o) => o.label}
                            placeholder={t(
                                'placeholders.chooseCountry',
                                'Choose country…',
                            )}
                        />
                        {fieldErrors.countryId && (
                            <p className="mt-1 text-xs text-red-600">
                                {fieldErrors.countryId}
                            </p>
                        )}
                    </label>

                    <label className="flex flex-col">
                        <span className="text-sm text-gray-600">
                            {t('fields.category', 'Category')}
                        </span>
                        <AsyncSelect<Opt, false>
                            className="mt-1"
                            classNamePrefix="rs"
                            cacheOptions
                            defaultOptions
                            loadOptions={loadCategoryOptions}
                            isClearable
                            value={categoryValue}
                            onChange={(opt) => {
                                if (!opt) {
                                    setForm((f) => ({ ...f, categoryId: '' }));
                                    setCategoryLabel(null);
                                } else {
                                    setForm((f) => ({
                                        ...f,
                                        categoryId: opt.value,
                                    }));
                                    setCategoryLabel(opt.label);
                                }
                            }}
                            placeholder={t(
                                'placeholders.chooseCategory',
                                'Choose category…',
                            )}
                        />
                        {fieldErrors.categoryId && (
                            <p className="mt-1 text-xs text-red-600">
                                {fieldErrors.categoryId}
                            </p>
                        )}
                    </label>

                    <label className="flex flex-col">
                        <span className="text-sm text-gray-600">
                            {t('fields.builder', 'Builder')}
                        </span>
                        <AsyncSelect<Opt, false>
                            className="mt-1"
                            classNamePrefix="rs"
                            cacheOptions
                            defaultOptions
                            loadOptions={loadBuilderOptions}
                            isClearable
                            value={builderValue}
                            onChange={(opt) => {
                                if (!opt) {
                                    setForm((f) => ({
                                        ...f,
                                        builderId: '',
                                        model: '',
                                    }));
                                    setBuilderLabel(null);
                                    setModelLabel(null);
                                } else {
                                    setForm((f) => ({
                                        ...f,
                                        builderId: opt.value,
                                        model: '',
                                    }));
                                    setBuilderLabel(opt.label);
                                    setModelLabel(null);
                                }
                            }}
                            placeholder={t(
                                'placeholders.chooseBuilder',
                                'Choose builder…',
                            )}
                        />
                    </label>

                    <label className="flex flex-col">
                        <span className="text-sm text-gray-600">
                            {t('fields.model', 'Model')}
                        </span>
                        <AsyncSelect<Opt, false>
                            className="mt-1"
                            classNamePrefix="rs"
                            cacheOptions
                            defaultOptions
                            loadOptions={loadModelOptions}
                            isClearable
                            value={modelValue}
                            onChange={(opt) => {
                                if (!opt) {
                                    setForm((f) => ({ ...f, model: '' }));
                                    setModelLabel(null);
                                } else {
                                    setForm((f) => ({
                                        ...f,
                                        model: opt.value,
                                    }));
                                    setModelLabel(opt.label);
                                }
                            }}
                            placeholder={t(
                                'placeholders.chooseModel',
                                'Choose model…',
                            )}
                        />
                    </label>
                </fieldset>

                <YachtSpecsSection
                    values={{
                        length: form.length,
                        builtYear: form.builtYear,
                        cabins: form.cabins,
                        heads: form.heads,
                    }}
                    onChange={(field, value) =>
                        setForm((f) => ({ ...f, [field]: value }))
                    }
                    t={t}
                />

                <YachtPricingSection
                    basePrice={form.basePrice}
                    maxDiscountPct={form.maxDiscountPct}
                    onBasePriceChange={(v) =>
                        setForm((f) => ({ ...f, basePrice: v }))
                    }
                    onMaxDiscountPctChange={(v) =>
                        setForm((f) => ({ ...f, maxDiscountPct: v }))
                    }
                    yacht={yacht}
                    t={t}
                />

                <YachtExtraServicesSection
                    value={form.currentExtraServices}
                    onChange={(v) =>
                        setForm((f) => ({ ...f, currentExtraServices: v }))
                    }
                    t={t}
                />

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
                            ? isCreate
                                ? t('actions.creating', 'Creating…')
                                : t('actions.saving', 'Saving…')
                            : isCreate
                                ? t('actions.create', 'Create')
                                : t('actions.save', 'Save')}
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
                            title={t(
                                'actions.deleteTitle',
                                'Delete this yacht',
                            )}
                        >
                            {deleting
                                ? t('actions.deleting', 'Deleting…')
                                : t('actions.delete', 'Delete')}
                        </button>
                    )}
                </div>
            </form>
        </div>
    );

}
