// frontend/src/api.ts

import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosHeaders,
  AxiosRequestHeaders,
} from "axios";

// ---- Глобальный тип для window.Clerk ----
declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: (opts?: { refresh?: boolean }) => Promise<string | null>;
      };
    };
  }
}

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
  sort?: "priceAsc" | "priceDesc" | "yearAsc" | "yearDesc" | "createdDesc";
  page?: number;
  pageSize?: number;
};

export type YachtListResponse = {
  items: Yacht[];
  total: number;
  page: number;
  pageSize: number;
};

// ============================
// Общий Axios-клиент
// ============================

const API_BASE: string = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE,
});

// Helper: гарантируем, что у нас именно AxiosHeaders (а не undefined)
function ensureHeaders(
  headers?: AxiosRequestHeaders
): AxiosHeaders {
  return headers instanceof AxiosHeaders
    ? headers
    : new AxiosHeaders(headers ?? {});
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
  }
  return config;
});

// Тип для конфига с нашим флагом ретрая
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Один автоматический ретрай при 401 с принудительным refresh токена
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const cfg = (error.config ?? {}) as RetryableConfig;

    if (error.response?.status === 401 && !cfg._retry) {
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

// ============================
// Yachts API
// ============================

export async function listYachts(params: YachtListParams): Promise<YachtListResponse> {
  const { data } = await api.get<YachtListResponse>("/yachts", { params });
  return data;
}

export async function getYachts(): Promise<Yacht[]> {
  const { data } = await api.get("/yachts");
  return Array.isArray(data) ? (data as Yacht[]) : ((data as { items?: Yacht[] })?.items ?? []);
}

export async function getYacht(id: string): Promise<Yacht> {
  const { data } = await api.get<Yacht>(`/yachts/${id}`);
  return data;
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
//
// Scraper API (mock backend)
//
// ============================

export type ScrapeSource = "BOATAROUND" | "SEARADAR";
export type JobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export type ScrapeJobDTO = {
  id: string;
  status: JobStatus;
  error?: string | null;
};

export type StartScrapePayload = {
  source?: ScrapeSource;
  yachtId?: string;
  weekStart?: string; // ISO YYYY-MM-DD
  location?: string;
  type?: string;
  minYear?: number;
  maxYear?: number;
  minLength?: number; // метры
  maxLength?: number; // метры
  people?: number;
  cabins?: number;
  heads?: number;
};

export type StartScrapeResult = {
  jobId: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
};

export async function startScrape(payload: StartScrapePayload): Promise<StartScrapeResult> {
  const { data } = await api.post<StartScrapeResult>("/scrape/start", payload);
  return data;
}

// сырой тип ответа для /scrape/status
type ScrapeStatusRaw = {
  id?: string;
  status?: JobStatus | string;
  error?: string | null;
};

export async function getScrapeStatus(jobId: string): Promise<ScrapeJobDTO> {
  const { data } = await api.get<ScrapeStatusRaw>("/scrape/status", {
    params: { jobId },
  });
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
  price: string; // строка
  currency: string | null;
  link: string | null;
  scrapedAt: string; // ISO
  lengthFt?: number | null;
  cabins?: number | null;
  heads?: number | null;
  year?: number | null;
  marina?: string | null;
};

export async function listCompetitorPrices(params: { yachtId?: string; week?: string }) {
  const { data } = await api.get<CompetitorPrice[]>("/scrape/competitors-prices", {
    params,
  });
  return data;
}