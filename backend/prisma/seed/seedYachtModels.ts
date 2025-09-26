// /backend/prisma/seed/seedYachtModels.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const NAUSYS_URL = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/yachtModels";
const USERNAME = process.env.NAUSYS_USERNAME || "rest388@TTTTT";
const PASSWORD = process.env.NAUSYS_PASSWORD || "e2THubBC";

type NauModel = {
  id: number;
  name: string;
  yachtCategoryId: number;
  yachtBuilderId: number;
  loa?: number;
  beam?: number;
  draft?: number;
  cabins?: number;
  wc?: number;
  waterTank?: number;
  fuelTank?: number;
  displacement?: number;
  virtualLength?: number;
};

type ModelsResponse = { status: string; models: NauModel[] };

// Универсальный helper — чистит возможный пролог/хвост NauSYS
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
  text = text.slice(s, e + 1);

  return JSON.parse(text) as T;
}

async function main() {
  const payload = { username: USERNAME, password: PASSWORD };
  const j = await fetchCleanJson<ModelsResponse>(NAUSYS_URL, payload);
  if (!Array.isArray(j.models)) throw new Error("Bad models payload");

  console.log("Models fetched:", j.models.length);

  const BATCH = 250; // обрабатываем батчами, чтобы не перегрузить транзакцию
  for (let i = 0; i < j.models.length; i += BATCH) {
    const chunk = j.models.slice(i, i + BATCH);

    await prisma.$transaction(
      chunk.map((m) =>
        prisma.yachtModel.upsert({
          where: { nausysId: m.id },
          update: {
            name: m.name,
            category: { connect: { nausysId: m.yachtCategoryId } },
            builder: { connect: { nausysId: m.yachtBuilderId } },
            loa: m.loa ?? null,
            beam: m.beam ?? null,
            draft: m.draft ?? null,
            cabins: m.cabins ?? null,
            wc: m.wc ?? null,
            waterTank: m.waterTank ?? null,
            fuelTank: m.fuelTank ?? null,
            displacement: m.displacement ?? null,
            virtualLength: m.virtualLength ?? null,
          },
          create: {
            nausysId: m.id,
            name: m.name,
            category: { connect: { nausysId: m.yachtCategoryId } },
            builder: { connect: { nausysId: m.yachtBuilderId } },
            loa: m.loa ?? null,
            beam: m.beam ?? null,
            draft: m.draft ?? null,
            cabins: m.cabins ?? null,
            wc: m.wc ?? null,
            waterTank: m.waterTank ?? null,
            fuelTank: m.fuelTank ?? null,
            displacement: m.displacement ?? null,
            virtualLength: m.virtualLength ?? null,
          },
        })
      )
    );

    console.log(
      `Upserted ${Math.min(i + BATCH, j.models.length)} / ${j.models.length}`
    );
  }

  console.log("Models upsert done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());