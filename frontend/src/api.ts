// frontend/src/api.ts

import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosHeaders,
  AxiosRequestHeaders,
} from "axios";

// ---- Types ----

export type YachtPriceHistoryItem = {
  date: string;
  weekStart: string;
  price: number | null;
  discountPct: number | null;
  source?: string | null;
  note?: string | null;
};

export interface Yacht {
  id: string
  name: string
  manufacturer: string
  model: string
  type: string
  length: number
  builtYear: number
  cabins: number
  heads: number
  basePrice: string | number
  location: string
  countryCode?: string | null
  countryName?: string | null
  fleet: string
  charterCompany: string
  currentExtraServices: string | Array<{ name: string; price: number }>
  ownerId: string | null
  ownerName?: string | null
  createdAt?: string
  updatedAt?: string
  // ─ Pricing additions for Yacht Details ─
  maxDiscountPct?: number | null
  actualPrice?: number | null
  actualDiscountPct?: number | null
  fetchedAt?: string | null
  // - Current price summary from PriceHistory/YachtDetailsDto ─
  currentPrice?: number | null
  currentDiscountPct?: number | null
  currentPriceUpdatedAt?: string | null
  priceHistory?: YachtPriceHistoryItem[]
   // 🔹 новое
  responsibleManagerId?: string | null
  responsibleManagerName?: string | null
  // 🔹 новые поля для текущей базовой цены на неделю и её валюты
  currentBasePrice?: number | null
  currency?: string | null
  selectedWeekStart?: string | null
}

export type YachtListParams = {
  q?: string;
  type?: string;
  minYear?: number;
  maxYear?: number;
  minPrice?: number;
  maxPrice?: number;
  categoryId?: number;
  sort?: "priceAsc" | "priceDesc" | "yearAsc" | "yearDesc" | "createdDesc";
  page?: number;
  pageSize?: number;
  /** неделя, для которой хотим получить basePrice, ISO YYYY-MM-DD */
  weekStart?: string;
};

export type YachtListResponse = {
  items: Yacht[];
  total: number;
  page: number;
  pageSize: number;
};

// ──────────────────────────────────────────────
// Pending pricing decisions (для уведомлений)
// ──────────────────────────────────────────────

export type PendingDecisionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED";

export type PendingPricingDecisionItem = {
  id: string;
  yachtId: string;
  /** Короткий ярлык яхты (имя/модель) для отображения */
  yachtLabel: string | null;
  /** Дата начала недели в формате YYYY-MM-DD */
  weekStart: string;
  status: PendingDecisionStatus;
};

export type PendingPricingDecisionsResponse = {
  count: number;
  items: PendingPricingDecisionItem[];
};

// ============================
// Общий Axios-клиент
// ============================

const API_BASE: string = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({ baseURL: API_BASE });

// 🔊 Лог — убеждаемся, что подхватился именно этот модуль
console.log("[api.ts] module loaded, baseURL =", API_BASE);

// Helper: безопасно привести к числу или вернуть null
function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : null;
}

// Helper: гарантируем AxiosHeaders
function ensureHeaders(headers?: AxiosRequestHeaders): AxiosHeaders {
  return headers instanceof AxiosHeaders ? headers : new AxiosHeaders(headers ?? {});
}

function joinUrl(base: string, path: string) {
  if (!path.startsWith("/")) path = "/" + path;
  return base.replace(/\/+$/, "") + path;
}

async function apiFetch(inputPath: string, init?: RequestInit) {
  // токен Clerk (как в axios-интерсепторе)
  const token = await getClerkToken();
  const headers = new Headers(init?.headers || {});
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const url = joinUrl(API_BASE, inputPath);
  // лог на всякий
  try {
    console.log("[api.ts] fetch", init?.method ?? "GET", url);
  // eslint-disable-next-line no-empty
  } catch {}
  return fetch(url, { ...init, headers });
}

// маленький helper для токена Clerk
async function getClerkToken(opts?: { refresh?: boolean }): Promise<string | null> {
  try {
    const s = window.Clerk?.session;
    if (!s?.getToken) return null;
    return await s.getToken(opts);
  } catch {
    return null;
  }
}

// Подставляем Bearer JWT в каждый запрос
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getClerkToken();
  if (token) {
    const headers = ensureHeaders(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;

    // 🔊 видно всегда
    try {
      console.log(
        "[api.ts] attached Clerk token (first16):",
        token.slice(0, 16),
        "… →",
        config.method?.toUpperCase(),
        config.baseURL + (config.url || "")
      );
      // eslint-disable-next-line no-empty
    } catch {}
  } else {
    console.log("[api.ts] Clerk token missing (getToken() returned null)");
  }
  return config;
});

// Тип для конфига с нашим флагом ретрая
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Один ретрай при 401 с принудительным refresh токена
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const cfg = (error.config ?? {}) as RetryableConfig;

    if (error.response?.status === 401 && !cfg._retry) {
      console.warn("[api.ts] 401 from", cfg.url, "→ try refresh token & retry once");
      cfg._retry = true;
      const fresh = await getClerkToken({ refresh: true });
      if (fresh) {
        const headers = ensureHeaders(cfg.headers);
        headers.set("Authorization", `Bearer ${fresh}`);
        cfg.headers = headers;
        return api.request(cfg);
      }
    }
    throw error;
  }
);

// ──────────────────────────────────────────────
// API: pending pricing decisions (для Dashboard)
// ──────────────────────────────────────────────

export async function getPendingPricingDecisions(): Promise<PendingPricingDecisionsResponse> {
  const { data } = await api.get<PendingPricingDecisionsResponse>(
    "/pricing-decisions/pending"
  );
  return data;
}

// ============================
// Yachts API
// ============================

// Сырой ответ может приходить с разными именами полей (Pct/Percent, currentPrice/Discount, priceFetchedAt/fetchedAt)
type YachtRaw = {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  type: string;
  length: number;
  builtYear: number;
  cabins: number;
  heads: number;
  basePrice: string | number;
  location: string;
  fleet: string;
  charterCompany: string;
  currentExtraServices: string | Array<{ name: string; price: number }>;
  ownerId: string | null;
  ownerName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  countryCode?: string | null;
  countryName?: string | null;

  // ─ возможные варианты pricing-полей с бэка ─
  maxDiscountPct?: number | string | null;
  maxDiscountPercent?: number | string | null;

  actualPrice?: number | string | null;
  // "сырые" текущие значения (могут приходить как string/number)
  currentPrice?: number | string | null;

  actualDiscountPct?: number | string | null;
  actualDiscountPercent?: number | string | null;
  currentDiscount?: number | string | null;
  currentDiscountPct?: number | string | null;

  fetchedAt?: string | null;
  priceFetchedAt?: string | null;

  // ─ расширенный DTO с историей и текущим snapshot ─
  currentPriceUpdatedAt?: string | null;

  priceHistory?: Array<{
    date: string;
    weekStart: string;
    price: number | string | null;
    discountPct: number | string | null;
    source?: string | null;
    note?: string | null;
  }> | null;

  // ─ weekly base price additions (YachtDetailsDto) ─
  currentBasePrice?: number | string | null;
  currency?: string | null;
  selectedWeekStart?: string | null;
};


export async function listYachts(params: YachtListParams): Promise<YachtListResponse> {
  const { data } = await api.get<YachtListResponse>("/yachts", { params });
  return data;
}

export async function getYachts(): Promise<Yacht[]> {
  // Вернём список яхт
  const { data } = await api.get("/yachts");
  return Array.isArray(data)
    ? (data as Yacht[])
    : ((data as { items?: Yacht[] })?.items ?? []);
}

export async function getYacht(
  id: string,
  params?: { weekStart?: string | null }
): Promise<Yacht> {
  // Грузим деталь (можно указать ?weekStart=2025-06-14)
  const { data } = await api.get<YachtRaw>(`/yachts/${id}`, {
    params: params?.weekStart ? { weekStart: params.weekStart } : undefined,
  });
  const normalized: Yacht = {
    ...data,
    maxDiscountPct:
      toNum(data?.maxDiscountPct) ??
      toNum(data?.maxDiscountPercent) ??
      null,
     actualPrice:
      toNum(data?.actualPrice) ??
      toNum(data?.currentPrice) ??
      null,
    actualDiscountPct:
      toNum(data?.actualDiscountPct) ??
      toNum(data?.actualDiscountPercent) ??
      toNum(data?.currentDiscount) ??
      null,
    fetchedAt: data?.fetchedAt ?? data?.priceFetchedAt ?? null,
    // NEW: current price snapshot from backend (YachtDetailsDto)
    currentPrice: toNum(data?.currentPrice),
    currentDiscountPct: toNum(data?.currentDiscountPct),
    currentPriceUpdatedAt: data?.currentPriceUpdatedAt ?? null,
    priceHistory: (data?.priceHistory ?? []).map((h) => ({
      date: h.date,
      weekStart: h.weekStart,
      price: toNum(h.price),
      discountPct: toNum(h.discountPct),
      source: h.source ?? null,
      note: h.note ?? null,
    })),
    // 🔹 weekly base price additions
    currentBasePrice: toNum(data?.currentBasePrice),
    currency: data?.currency ?? null,
    selectedWeekStart: data?.selectedWeekStart ?? null,
  };
  return normalized
}

export type YachtUpdatePayload = {
  name?: string;
  manufacturer?: string;
  model?: string;
  type?: string;
  location?: string;
  fleet?: string;
  charterCompany?: string;
  ownerName?: string;
  length?: string;
  builtYear?: string;
  cabins?: string;
  heads?: string;
  basePrice?: string;
  currentExtraServices?: string | Array<{ name: string; price: number }>;
  // NEW: allow updating max discount %
  maxDiscountPct?: number | string | null;
  // --- новые связи ---
  countryId?: string | null;
  categoryId?: number | null;
  builderId?: number | null;
   // 🔹 новое поле для бэкенда
  responsibleManagerId?: string | null;
  nausysId?: string | null;
};

export async function updateYacht(id: string, payload: YachtUpdatePayload): Promise<Yacht> {
  const { data } = await api.patch<Yacht>(`/yachts/${id}`, payload);
  return data;
}

export async function createYacht(payload: YachtUpdatePayload): Promise<Yacht> {
  const { data } = await api.post<Yacht>("/yachts", payload);
  return data;
}

export async function deleteYacht(id: string): Promise<{ success: boolean }> {
  const { data } = await api.delete<{ success: boolean }>(`/yachts/${id}`);
  return data;
}

// ============================
// Scraper API (mock backend)
// ============================

export type ScrapeSource = 'INNERDB' | 'NAUSYS'  | 'BOATAROUND';
export type JobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export type ScrapeJobDTO = {
  id: string;
  status: JobStatus;
  error?: string | null;
};

export type StartScrapePayload = {
  source?: ScrapeSource;
  yachtId: string;
  weekStart: string; // ISO YYYY-MM-DD
  filterId?: string; 
  location?: string;
  type?: string;
  minYear?: number;
  maxYear?: number;
  minLength?: number;
  maxLength?: number;
  people?: number;
  cabins?: number;
  heads?: number;
};

// --- NEW: ответ старта сканирования (совпадает с бэком)
export type StartResponseDto = {
  jobId: string;
  status: JobStatus;
  kept: number;
  reasons?: string[];
};

// ---- Start a scrape job ----
export async function startScrape(payload: StartScrapePayload): Promise<StartResponseDto> {
  const { data } = await api.post<StartResponseDto>("/scrape/start", payload);
  return data;
}

type ScrapeStatusRaw = { id?: string; status?: JobStatus | string; error?: string | null };

export async function getScrapeStatus(jobId: string): Promise<ScrapeJobDTO> {
  const { data } = await api.get<ScrapeStatusRaw>("/scrape/status", { params: { jobId } });
  return {
    id: data?.id ?? jobId,
    status: ((data?.status as JobStatus) ?? "FAILED") as JobStatus,
    error: data?.error ?? null,
  };
}

export type Snapshot = {
  id: string;
  yachtId: string;
  weekStart: string; // ISO
  source: ScrapeSource;
  top1Price: string;
  top3Avg: string;
  currency: string;
  sampleSize: number;
  rawStats?: unknown; // JSON
};

export async function aggregateSnapshot(args: {
  yachtId: string;
  week: string;
  source?: ScrapeSource;
}): Promise<Snapshot | null> {
  const { data } = await api.post<Snapshot | null>("/scrape/aggregate", args);
  return data;
}

export type CompetitorPrice = {
  id: string;
  yachtId: string | null;
  weekStart: string; // ISO
  source: ScrapeSource;
  competitorYacht: string | null;
  price: string;              // Decimal → строка
  currency: string | null;
  link: string | null;
  scrapedAt: string;          // ISO

  // базовые характеристики лодки-конкурента
  lengthFt?: number | null;
  cabins?: number | null;
  heads?: number | null;
  year?: number | null;
  marina?: string | null;     // сырой ID/название марины (для совместимости)

  // денежные параметры
  discountPct?: string | null; // Decimal → строка
  feesTotal?: string | null;   // Decimal → строка

  // измерения/ссылки на справочники
  countryCode?: string | null;
  countryId?: string | null;
  categoryId?: number | null;
  regionId?: number | null;
  locationId?: string | null;
  builderId?: number | null;
  modelId?: number | null;

  // "расплющенные" имена из справочников (удобно для UI)
  modelName?: string | null;
  marinaName?: string | null;
  countryName?: string | null;
};

export async function listCompetitorPrices(params: { yachtId?: string; week?: string; source?: ScrapeSource }) {
  const { data } = await api.get<CompetitorPrice[]>('/scrape/competitors-prices', {
    params: params as { yachtId?: string; week?: string; source?: ScrapeSource },
  })
  return data
}

// --- GEO API ---
export type Country = { id: string; code2: string; name: string; nausysId: number; code3?: string | null };
export type LocationItem = {
  id: string;
  name: string;
  regionId: number | null;
  regionName: string | null;
  countryId: string | null;
  country?: { code2: string; name: string } | null;
};

// --- COUNTRIES (UUID-based) ---
export async function getCountries(): Promise<Country[]> {
  // unified endpoint (was /geo/countries)
  const r = await apiFetch("/catalog/countries");
  if (!r.ok) throw new Error("Failed to load countries");
  const { items } = await r.json();
  return items as Country[];
}

export async function getLocations(params: {
  q?: string;
  countryIds?: string[]; // ← теперь UUID

  regionIds?: number[];
  source?: string;
  take?: number;
  skip?: number;
  orderBy?: "name" | "countryCode";
}): Promise<{ items: LocationItem[]; total: number; skip: number; take: number }> {
  const paramsQS = new URLSearchParams();
  if (params.q) paramsQS.set("q", params.q);
  if (params.take) paramsQS.set("take", String(params.take));
  if (params.skip) paramsQS.set("skip", String(params.skip));
  if (params.orderBy) paramsQS.set("orderBy", params.orderBy);
  if (params.source) paramsQS.set("source", params.source);

  if (params.countryIds?.length) {
    for (const id of params.countryIds) paramsQS.append("countryIds", id);
  }
  if (params.regionIds?.length) {
    for (const id of params.regionIds) paramsQS.append("regionIds", String(id));
  }

  const r = await apiFetch(`/catalog/locations?${paramsQS.toString()}`);
  if (!r.ok) throw new Error("Failed to load locations");
  return r.json();
}

// ---- Catalog lookups ----
export type CatalogCategory = { id: number; nameEn?: string | null; nameRu?: string | null };
export type CatalogBuilder  = { id: number; name: string };
export type CatalogModel    = { id: number; name: string; builderId?: number | null; categoryId?: number | null };

export type CatalogRegion = {
  id: number;
  nameEn?: string | null;
  nameRu?: string | null;
  nameDe?: string | null;
  countryId?: string | null; // ← UUID
  country?: { code2: string; name: string } | null;
};

export async function findCategories(query = "", take = 20) {
  const r = await apiFetch(`/catalog/categories?query=${encodeURIComponent(query)}&take=${take}`);
  if (!r.ok) throw new Error("categories HTTP " + r.status);
  return (await r.json()) as { items: CatalogCategory[] };
}

export async function findBuilders(query = "", take = 20) {
  const r = await apiFetch(`/catalog/builders?query=${encodeURIComponent(query)}&take=${take}`);
  if (!r.ok) throw new Error("builders HTTP " + r.status);
  return (await r.json()) as { items: CatalogBuilder[] };
}

export async function findModels(
  query = "",
  opts?: { builderId?: number; categoryId?: number; take?: number }
) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (opts?.builderId)  params.set("builderId", String(opts.builderId));
  if (opts?.categoryId) params.set("categoryId", String(opts.categoryId));
  params.set("take", String(opts?.take ?? 20));
  const r = await apiFetch(`/catalog/models?${params.toString()}`);
  if (!r.ok) throw new Error("models HTTP " + r.status);
  return (await r.json()) as { items: CatalogModel[] };
}

export async function findRegions(
  query = "",
  opts?: { countryIds?: string[]; take?: number; skip?: number }
) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (opts?.take != null) params.set("take", String(opts.take));
  if (opts?.skip != null) params.set("skip", String(opts.skip));

  if (opts?.countryIds?.length) {
    for (const id of opts.countryIds) params.append("countryIds", id);
  }

  const r = await apiFetch(`/catalog/regions?${params.toString()}`);
  if (!r.ok) throw new Error("regions HTTP " + r.status);
  return (await r.json()) as { items: CatalogRegion[] };
}

// ---- Save Competitor Filters ----
export async function saveCompetitorFilters(dto: {
  scope: "USER" | "ORG";
  locationIds?: string[];
  countryIds?: string[];       // ← теперь UUID: [ "cmg674pw..." ]
  categoryIds?: number[];
  builderIds?: number[];
  modelIds?: number[];
  regionIds?: number[];
  lenFtMinus: number;
  lenFtPlus: number;
  yearMinus: number;
  yearPlus: number;
  peopleMinus: number;
  peoplePlus: number;
  cabinsMinus: number;
  cabinsPlus: number;
  headsMin: number;
}) {
   const { data } = await api.patch("/filters/competitors", dto);
  return data;
}

// ---- Reset Competitor Filters ----
export async function resetCompetitorFilters(scope: "USER" | "ORG") {
  const { data } = await api.delete("/filters/competitors", { params: { scope } });
  return data;
}

// ---- Upsert (sugar over save) ----
export type CompetitorFiltersDto = Parameters<typeof saveCompetitorFilters>[0];
export async function upsertCompetitorFilters(dto: CompetitorFiltersDto)
  : Promise<{ id: string }> {
  const data = await saveCompetitorFilters(dto);
  // бек отдаёт объект с id — приводим тип явно
  return data as { id: string };
}

// ---- Test scan (dry-run) ----
export async function testFiltersCount<T extends object>(
  payload: T
): Promise<{ count: number }> {
  // бек ждёт POST /filters/competitors/test
  const r = await apiFetch("/filters/competitors/test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("test-scan HTTP " + r.status);
  return (await r.json()) as { count: number };
}

export type ServerCompetitorFilters = {
  id: string;
  orgId: string;
  scope: "USER" | "ORG";
  userId: string | null;
  lenFtMinus: number;
  lenFtPlus: number;
  yearMinus: number;
  yearPlus: number;
  peopleMinus: number;
  peoplePlus: number;
  cabinsMinus: number;
  cabinsPlus: number;
  headsMin: number;
  locations: Array<{ id: string; name: string; countryCode: string | null }>;
  // NEW:
  categories?: Array<{ id: number; nameEn?: string | null; nameRu?: string | null }>;
  builders?:   Array<{ id: number; name: string }>;
  models?:     Array<{ id: number; name: string; builderId?: number | null; categoryId?: number | null }>;
  regions?:    Array<CatalogRegion>;
  countries?: Array<{ id: string; code2: string; name: string }>;
};


export async function getCompetitorFilters(): Promise<ServerCompetitorFilters | null> {
  try {
    const { data } = await api.get<ServerCompetitorFilters | null>("/filters/competitors");
    return data ?? null;
  } catch (e) {
    // если реально 404 — вернём null, остальные ошибки пробросим в консоль
    console.warn("[api.getCompetitorFilters] failed:", e);
    return null;
  }
}

// ============================
// Filter Presets API
// ============================
//
// Таблица CompetitorFilterPreset в бэкенде:
// id, orgId, userId, scope, name,
// countryIds[], regionIds[], locationIds[],
// categoryIds[], builderIds[], modelIds[],
// lenFtMinus/Plus, yearMinus/Plus, peopleMinus/Plus,
// cabinsMinus/Plus, headsMin, timestamps
//
// На фронтенде нам нужно:
//  - получить список пресетов юзера (listPresets)
//  - создать новый (createPreset)
//  - обновить существующий (updatePreset)
//  - удалить (deletePreset)
//  - получить конкретный (getPreset)
//

export type FilterPreset = {
  id: string;
  orgId: string;
  userId: string | null;
  scope: "USER" | "ORG";
  name: string;

  countryIds: string[];
  regionIds: number[];
  locationIds: string[];

  categoryIds: number[];
  builderIds: number[];
  modelIds: number[];

  lenFtMinus: number;
  lenFtPlus: number;
  yearMinus: number;
  yearPlus: number;
  peopleMinus: number;
  peoplePlus: number;
  cabinsMinus: number;
  cabinsPlus: number;
  headsMin: number;

  createdAt: string;
  updatedAt: string;
};

// тело на создание/обновление — то, что разрешает сервис
export type FilterPresetInput = {
  name?: string;
  scope?: "USER" | "ORG";
  countryIds?: string[];
  regionIds?: number[];
  locationIds?: string[];
  categoryIds?: number[];
  builderIds?: number[];
  modelIds?: number[];
  lenFtMinus?: number;
  lenFtPlus?: number;
  yearMinus?: number;
  yearPlus?: number;
  peopleMinus?: number;
  peoplePlus?: number;
  cabinsMinus?: number;
  cabinsPlus?: number;
  headsMin?: number;
};

// GET /filters/presets → список пресетов текущего юзера в его org
export async function listFilterPresets(): Promise<FilterPreset[]> {
  const { data } = await api.get<FilterPreset[]>("/filters/presets");
  return data;
}

// GET /filters/presets/:id → один пресет (валидация orgId на бэке)
export async function getFilterPreset(id: string): Promise<FilterPreset | null> {
  const { data } = await api.get<FilterPreset | null>(`/filters/presets/${id}`);
  return data ?? null;
}

// POST /filters/presets → создать (name обязателен по смыслу UI)
export async function createFilterPreset(input: FilterPresetInput): Promise<FilterPreset> {
  const { data } = await api.post<FilterPreset>("/filters/presets", input);
  return data;
}

// PATCH /filters/presets/:id → частично обновить
export async function updateFilterPreset(
  id: string,
  input: FilterPresetInput
): Promise<FilterPreset> {
  const { data } = await api.patch<FilterPreset>(`/filters/presets/${id}`, input);
  return data;
}

// DELETE /filters/presets/:id → удалить
export async function deleteFilterPreset(
  id: string
): Promise<{ count: number }> {
  const { data } = await api.delete<{ count: number }>(`/filters/presets/${id}`);
  return data;
}