// Опишем интерфейс Yacht под поля из Prisma
export interface Yacht {
    id: number;
    name: string;
    manufacturer: string;
    model: string;
    type: string;
    length: number;
    builtYear: number;
    cabins: number;
    heads: number;
    basePrice: number;
    location: string;
    fleet: string;
    charterCompany: string;
    currentExtraServices: string; // если хранится JSON в строке
    ownerId: number;
  }

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export async function getYachts() {
  const res = await fetch(`${API}/yachts`);
  if (!res.ok) throw new Error('Failed to load yachts');
  return res.json() as Promise<Yacht[]>;
}