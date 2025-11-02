// backend/src/scraper/vendors/nausys.types.ts

export type NauSysCandidate = {
  competitorYacht: string;
  lengthFt: number | null;
  cabins: number | null;
  heads: number | null;
  year: number | null;
  marina: string | null;
  type: string | null; // hint от target яхты
  countryCode: string | null;
  categoryId: number | null;
  builderId: number | null;
  price: number;
  currency: string;
  link: string;
};
