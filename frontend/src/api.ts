// Тип из нашего API (ближе к Prisma)
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
  // createdAt/updatedAt можно добавить, если нужно:
  // createdAt?: string;
  // updatedAt?: string;
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export async function getYachts(): Promise<Yacht[]> {
  const res = await fetch(`${API}/yachts`);
  if (!res.ok) throw new Error('Failed to load yachts');
  return res.json();
}

export async function getYacht(id: string): Promise<Yacht> {
  const res = await fetch(`${API}/yachts/${id}`);
  if (!res.ok) throw new Error('Yacht not found');
  return res.json();
}

// бекенд сам приведёт типы; на фронте отправляем строки
export type YachtUpdatePayload = {
  name?: string;
  manufacturer?: string;
  model?: string;
  type?: string;
  location?: string;
  fleet?: string;
  charterCompany?: string;

  length?: string;
  builtYear?: string;
  cabins?: string;
  heads?: string;

  basePrice?: string;

  currentExtraServices?: string | Array<{ name: string; price: number }>;

  ownerName?: string; 
  
};

export async function updateYacht(
  id: string,
  payload: YachtUpdatePayload
): Promise<Yacht> {
  const res = await fetch(`${API}/yachts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update yacht');
  return res.json();
}

export async function createYacht(payload: YachtUpdatePayload) {
  const res = await fetch(`${API}/yachts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create yacht');
  return res.json() as Promise<Yacht>;
}

export async function deleteYacht(id: string) {
  const res = await fetch(`${API}/yachts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete yacht');
  return res.json() as Promise<{ success: boolean }>;
}
