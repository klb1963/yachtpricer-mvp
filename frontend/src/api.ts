// frontend/src/api.ts

// ---- Types ----
export interface Yacht {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  type: string;
  length: number;
  builtYear: number;
  cabins: number;
  heads: number;
  basePrice: string | number; // Decimal приходит строкой
  location: string;
  fleet: string;
  charterCompany: string;
  currentExtraServices: string | Array<{ name: string; price: number }>;
  ownerId: string | null;
  ownerName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type YachtListParams = {
  q?: string;
  type?: string;
  minYear?: number;
  maxYear?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'priceAsc' | 'priceDesc' | 'yearAsc' | 'yearDesc' | 'createdDesc';
  page?: number;
  pageSize?: number;
};

export type YachtListResponse = {
  items: Yacht[];
  total: number;
  page: number;
  pageSize: number;
};

// ---- HTTP helpers ----
const API = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL ?? '/api');
console.log('[API] base URL =', API);

// список с фильтрами/пагинацией (совместимо с новым бекэндом)
export async function listYachts(params: YachtListParams): Promise<YachtListResponse> {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  });
  const res = await fetch(`${API}/yachts?${sp.toString()}`);
  if (!res.ok) throw new Error('Failed to load yachts');
  return res.json();
}

export async function getYachts(): Promise<Yacht[]> {
  const res = await fetch(`${API}/yachts`);
  if (!res.ok) throw new Error('Failed to load yachts');

  const data = await res.json();
  // Бэкенд мог вернуть либо массив (старый формат), либо объект { items, ... } (новый)
  if (Array.isArray(data)) return data as Yacht[];
  return (data?.items ?? []) as Yacht[];
}

// получить одну яхту
export async function getYacht(id: string): Promise<Yacht> {
  const res = await fetch(`${API}/yachts/${id}`);
  if (!res.ok) throw new Error('Yacht not found');
  return res.json();
}

// обновление/создание
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
};

export async function updateYacht(id: string, payload: YachtUpdatePayload): Promise<Yacht> {
  const res = await fetch(`${API}/yachts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update yacht');
  return res.json();
}

export async function createYacht(payload: YachtUpdatePayload): Promise<Yacht> {
  const res = await fetch(`${API}/yachts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create yacht');
  return res.json();
}

export async function deleteYacht(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API}/yachts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete yacht');
  return res.json();
}

// ============================
// Scraper API (mock backend)
// ============================

export type ScrapeSource = 'BOATAROUND' | 'SEARADAR';

// Статус джобы и тип ответа /scrape/status
export type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export type ScrapeJobDTO = {
  id: string;
  status: JobStatus;
  error?: string | null;
};

// Параметры 1:1 с backend StartScrapeDto (всё опционально)
export type StartScrapePayload = {
  source?: ScrapeSource;
  yachtId?: string;
  weekStart?: string;   // ISO YYYY-MM-DD (любой день той недели)
  location?: string;
  type?: string;
  minYear?: number;
  maxYear?: number;
  minLength?: number;   // метры
  maxLength?: number;   // метры
  people?: number;
  cabins?: number;
  heads?: number;
};

export type StartScrapeResult = {
  jobId: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
};

/**
 * POST /scrape/start
 * Старт скрейпа (мок). Возвращает jobId.
 */
export async function startScrape(payload: StartScrapePayload): Promise<StartScrapeResult> {
  const res = await fetch(`${API}/scrape/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`startScrape failed: ${res.status}`);
  return res.json();
}

/**
 * GET /scrape/status?jobId=...
 * Бэкенд возвращает запись ScrapeJob из Prisma; нас интересует status.
 */
export async function getScrapeStatus(jobId: string): Promise<ScrapeJobDTO> {
  const res = await fetch(`${API}/scrape/status?jobId=${encodeURIComponent(jobId)}`);
  if (!res.ok) throw new Error(`status failed: ${res.status}`);
  const job = await res.json();
  return {
    id: job?.id ?? jobId,
    status: (job?.status ?? 'FAILED') as JobStatus,
    error: job?.error ?? null,
  };
}

// Ответ агрегата CompetitorSnapshot (Prisma.Decimal -> string)
export type Snapshot = {
  id: string;
  yachtId: string;
  weekStart: string;       // ISO
  source: ScrapeSource;
  top1Price: string;       // строка
  top3Avg: string;         // строка
  currency: string;
  sampleSize: number;
  rawStats?: unknown;      // JSON со срезом карточек
};

/**
 * POST /scrape/aggregate
 * Агрегирует сохранённые цены в снапшот (TOP1/AVG).
 * Возвращает Snapshot или null, если данных нет.
 */
export async function aggregateSnapshot(args: { yachtId: string; week: string; source?: ScrapeSource }): Promise<Snapshot | null> {
  const res = await fetch(`${API}/scrape/aggregate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`aggregate failed: ${res.status}`);
  return res.json();
}

// Сырые цены конкурентов — удобно показывать в «Details»
export type CompetitorPrice = {
  id: string;
  yachtId: string | null;
  weekStart: string;     // ISO
  source: ScrapeSource;
  competitorYacht: string | null;
  price: string;         // строка
  currency: string | null;
  link: string | null;
  scrapedAt: string;     // ISO
  lengthFt?: number | null;
  cabins?: number | null;
  heads?: number | null;
  year?: number | null;
  marina?: string | null;
};

/**
 * GET /scrape/competitors-prices?yachtId=&week=
 * Возвращает массив карточек конкурентов (последние 50).
 * Параметр week — любой день нужной недели; бэкенд нормализует к субботе.
 */
export async function listCompetitorPrices(params: { yachtId?: string; week?: string }) {
  const qs = new URLSearchParams();
  if (params.yachtId) qs.set('yachtId', params.yachtId);
  if (params.week) qs.set('week', params.week);
  const res = await fetch(`${API}/scrape/competitors-prices?${qs.toString()}`);
  if (!res.ok) throw new Error(`competitors failed: ${res.status}`);
  return res.json() as Promise<CompetitorPrice[]>;
}
