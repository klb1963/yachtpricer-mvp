// /backend/prisma/seed/scanCompetitors.step1.ts

/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Входные данные
const LOCATIONS = [
  { externalId: "54", name: "Marina Kastela" },
  { externalId: "57", name: "Dubrovnik, Komolac" },
  { externalId: "1016367", name: "Trogir" },
];

const USERNAME = process.env.NAUSYS_USERNAME || "rest388@TTTTT";
const PASSWORD = process.env.NAUSYS_PASSWORD || "e2THubBC";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(`${url} HTTP ${r.status}`);
  }
  return (await r.json()) as T;
}

async function main() {
  // 1) charterBases → companyIds
  const basesRes = await postJson<any>(
    "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/charterBases",
    { username: USERNAME, password: PASSWORD }
  );

  const wantedLocIds = new Set(LOCATIONS.map(l => Number(l.externalId)));
  const companyIds = Array.from(
    new Set(
      (basesRes?.bases ?? [])
        .filter((b: any) => wantedLocIds.has(Number(b?.locationId)))
        .map((b: any) => Number(b?.companyId))
    )
  );

  console.log("[1] Found companies:", companyIds);

  if (companyIds.length === 0) {
    console.warn("No companies found for these locations");
    return;
  }

  // 2) по каждой компании → yachts
  for (const companyId of companyIds) {
    const yRes = await postJson<any>(
      `https://ws.nausys.com/CBMS-external/rest/catalogue/v6/yachts/${companyId}`,
      { username: USERNAME, password: PASSWORD }
    );

    const yachts = (yRes?.yachts ?? []).filter((y: any) =>
      wantedLocIds.has(Number(y?.locationId))
    );

    console.log(`[2] Company ${companyId} → yachts in our locations:`, yachts.length);
    yachts.forEach((y: any) => {
      console.log(
        `   - id=${y.id}, model=${y.yachtModelId}, year=${y.buildYear}, loc=${y.locationId}`
      );
    });
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error("Scan failed:", e);
  process.exit(1);
});