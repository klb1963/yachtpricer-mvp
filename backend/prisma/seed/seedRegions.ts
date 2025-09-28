// backend/prisma/seed/seedRegions.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const NAUSYS_URL = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/regions";
const USERNAME = process.env.NAUSYS_USERNAME!;
const PASSWORD = process.env.NAUSYS_PASSWORD!;

// как и раньше — чистим возможный пролог/эпилог
async function fetchCleanJson<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  let text = await r.text();
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("No JSON object found");
  return JSON.parse(text.slice(s, e + 1)) as T;
}

type RegionItem = {
  id: number;
  name?: { textEN?: string; textDE?: string; textRU?: string } | string | null;
  countryId?: number | null;
};
type RegionsResponse = { status: string; regions?: RegionItem[] };

function pickName(obj: RegionItem["name"]): {
  names: any; nameEn?: string | null; nameDe?: string | null; nameRu?: string | null;
} {
  if (obj && typeof obj === "object") {
    const n = obj as any;
    return {
      names: obj,
      nameEn: n.textEN ?? null,
      nameDe: n.textDE ?? null,
      nameRu: n.textRU ?? null,
    };
  }
  if (typeof obj === "string") {
    return { names: { textEN: obj }, nameEn: obj, nameDe: null, nameRu: null };
  }
  return { names: {}, nameEn: null, nameDe: null, nameRu: null };
}

async function main() {
  const j = await fetchCleanJson<RegionsResponse>(NAUSYS_URL, {
    username: USERNAME,
    password: PASSWORD,
  });
  const list = j.regions ?? [];
  console.log("Regions fetched:", list.length);

  let i = 0;
  for (const r of list) {
    const { names, nameEn, nameDe, nameRu } = pickName(r.name);
    await prisma.region.upsert({
      where: { nausysId: r.id },
      update: {
        names,
        nameEn,
        nameDe,
        nameRu,
        countryNausysId: r.countryId ?? null,
      },
      create: {
        nausysId: r.id,
        names,
        nameEn,
        nameDe,
        nameRu,
        countryNausysId: r.countryId ?? null,
      },
    });
    if (++i % 100 === 0) console.log(`Upserted ${i} / ${list.length}`);
  }
  console.log("Regions upsert done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => prisma.$disconnect());