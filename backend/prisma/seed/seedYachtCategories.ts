//  backend/prisma/seed/seedYachtCategories.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const NAUSYS_URL =
  "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/yachtCategories";
const USERNAME = process.env.NAUSYS_USERNAME || "rest388@TTTTT";
const PASSWORD = process.env.NAUSYS_PASSWORD || "e2THubBC";

type NauCategory = {
  id: number;
  name: Record<string, string>;
};

type CategoriesResponse = { categories: NauCategory[] };

async function fetchCategories(): Promise<NauCategory[]> {
  const r = await fetch(NAUSYS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!r.ok) throw new Error("categories HTTP " + r.status);

  const j: any = await r.json();
  if (!j || !Array.isArray(j.categories))
    throw new Error("Bad categories payload");
  return j.categories as NauCategory[];
}

async function main() {
  const list = await fetchCategories();
  console.log("Categories fetched:", list.length);

  for (const c of list) {
    await prisma.yachtCategory.upsert({
      where: { nausysId: c.id },
      update: {
        names: c.name,
        nameEn: c.name?.textEN ?? null,
        nameDe: c.name?.textDE ?? null,
        nameRu: c.name?.textRU ?? null,
      },
      create: {
        nausysId: c.id,
        names: c.name,
        nameEn: c.name?.textEN ?? null,
        nameDe: c.name?.textDE ?? null,
        nameRu: c.name?.textRU ?? null,
      },
    });
  }
  console.log("Categories upsert done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());