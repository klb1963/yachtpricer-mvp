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
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

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
