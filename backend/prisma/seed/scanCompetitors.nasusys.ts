// /workspace/backend/prisma/seed/scanCompetitors.nasusys.ts

/* eslint-disable no-console */
import { PrismaClient, JobStatus, ScrapeSource } from "@prisma/client";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// Конфиг
// ─────────────────────────────────────────────
const TARGET_YACHT_ID = "a6b9459f-4a60-40cd-a8af-48c54af03e00";

const LOCATIONS = [
  { externalId: "54", name: "Marina Kastela" },
  { externalId: "57", name: "Dubrovnik, Komolac" },
  { externalId: "1016367", name: "Trogir" },
];

const PERIOD_FROM = "19.09.2026"; // dd.MM.yyyy
const PERIOD_TO   = "26.09.2026";

const USERNAME = process.env.NAUSYS_USERNAME || "rest388@TTTTT";
const PASSWORD = process.env.NAUSYS_PASSWORD || "e2THubBC";

const BATCH_SIZE = 100;

// ─────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${url} HTTP ${r.status} ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${url} invalid JSON: ${text.slice(0, 300)}`);
  }
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v) : (typeof v === "number" ? v : NaN);
  return Number.isFinite(n) ? n : null;
}

function parseDate(d: string): Date {
  const [dd, mm, yyyy] = d.split(".");
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
}

function findLocationName(id: number | string): string | null {
  const s = String(id);
  const it = LOCATIONS.find(l => l.externalId === s);
  return it?.name ?? null;
}

function makeStableLink(yachtId: number, from: string, to: string): string {
  return `nausys://freeYacht?id=${yachtId}&from=${from}&to=${to}`;
}

// ─────────────────────────────────────────────
// main
// ─────────────────────────────────────────────
async function main() {
  const job = await prisma.scrapeJob.create({
    data: {
      source: ScrapeSource.NAUSYS,
      status: JobStatus.PENDING,
      params: { targetYachtId: TARGET_YACHT_ID, locations: LOCATIONS, periodFrom: PERIOD_FROM, periodTo: PERIOD_TO },
    },
  });

  try {
    await prisma.scrapeJob.update({ where: { id: job.id }, data: { status: JobStatus.RUNNING, startedAt: new Date() } });

    // 1) charterBases → companyIds
    const basesRes = await postJson<any>(
      "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/charterBases",
      { username: USERNAME, password: PASSWORD }
    );
    const wantedLocIds = new Set(LOCATIONS.map(l => Number(l.externalId)));
    const companyIds = Array.from(new Set(
      (basesRes?.bases ?? [])
        .filter((b: any) => wantedLocIds.has(Number(b?.locationId)))
        .map((b: any) => Number(b?.companyId))
        .filter((v: any) => Number.isFinite(v))
    ));
    console.log("[1] companies:", companyIds);

    if (companyIds.length === 0) throw new Error("No charter companies found for given locations.");

    // 2) yachts by company, filtered by location
    const yachtIds: number[] = [];
    for (const companyId of companyIds) {
      const yRes = await postJson<any>(
        `https://ws.nausys.com/CBMS-external/rest/catalogue/v6/yachts/${companyId}`,
        { username: USERNAME, password: PASSWORD }
      );
      const filtered = (yRes?.yachts ?? []).filter((y: any) => wantedLocIds.has(Number(y?.locationId)));
      filtered.forEach((y: any) => {
        const id = Number(y?.id);
        if (Number.isFinite(id)) yachtIds.push(id);
      });
      console.log(`[2] company ${companyId} → yachts:`, filtered.length);
    }
    const uniqueYachtIds = Array.from(new Set(yachtIds));
    console.log("[2] total unique yachts:", uniqueYachtIds.length);

    // 3) freeYachts
    const weekStart = parseDate(PERIOD_FROM);
    const freeItems: any[] = [];
    for (let i = 0; i < uniqueYachtIds.length; i += BATCH_SIZE) {
      const slice = uniqueYachtIds.slice(i, i + BATCH_SIZE);
      if (slice.length === 0) continue;
      const freeRes = await postJson<any>(
        "https://ws.nausys.com/CBMS-external/rest/yachtReservation/v6/freeYachts",
        {
          credentials: { username: USERNAME, password: PASSWORD },
          periodFrom: PERIOD_FROM,
          periodTo: PERIOD_TO,
          yachts: slice,
        }
      );
      const arr = Array.isArray(freeRes?.freeYachts) ? freeRes.freeYachts : [];
      console.log(`[3] freeYachts batch ${i}/${uniqueYachtIds.length}:`, arr.length);
      freeItems.push(...arr);
    }

    // 4) save competitor_prices
    let upserted = 0;
    for (const fy of freeItems) {
      const yachtIdNum = Number(fy?.yachtId);
      const link = makeStableLink(yachtIdNum, PERIOD_FROM, PERIOD_TO);
      const priceFinal = num(fy?.price?.clientPrice);
      const priceList = num(fy?.price?.priceListPrice);

      const discountPct = (() => {
        const d = Array.isArray(fy?.price?.discounts) ? fy.price.discounts : [];
        const percents = d.map((x: any) => num(x?.amount)).filter((v: number | null) => v != null) as number[];
        if (percents.length > 0) return percents.sort((a, b) => b - a)[0];
        if (priceList && priceFinal) {
          const pct = ((priceList - priceFinal) / priceList) * 100;
          return Number.isFinite(pct) ? Math.round(pct * 100) / 100 : null;
        }
        return null;
      })();

      const currency = String(fy?.price?.currency || "EUR");
      const marinaName = findLocationName(fy?.locationFromId) || null;

      if (priceFinal == null) continue;

      await prisma.competitorPrice.upsert({
        where: { source_link_weekStart: { source: ScrapeSource.NAUSYS, link, weekStart } },
        update: {
          yachtId: TARGET_YACHT_ID,
          competitorYacht: String(yachtIdNum),
          price: priceFinal,
          currency,
          raw: fy,
          externalId: String(yachtIdNum),
          marina: marinaName,
          discountPct: discountPct ?? null,
          feesTotal: num(fy?.price?.feesTotal),
          scrapeJobId: job.id,
          scrapedAt: new Date(),
        },
        create: {
          source: ScrapeSource.NAUSYS,
          weekStart,
          yachtId: TARGET_YACHT_ID,
          competitorYacht: String(yachtIdNum),
          price: priceFinal,
          currency,
          link,
          raw: fy,
          externalId: String(yachtIdNum),
          marina: marinaName,
          discountPct: discountPct ?? null,
          feesTotal: num(fy?.price?.feesTotal),
          scrapeJobId: job.id,
        },
      });
      upserted++;
    }
    console.log(`[4] saved competitor_prices: ${upserted}`);

    // 5) snapshot
    if (upserted > 0) {
      const rows = await prisma.competitorPrice.findMany({
        where: { yachtId: TARGET_YACHT_ID, weekStart, source: ScrapeSource.NAUSYS },
        select: { price: true, currency: true },
        orderBy: { price: "asc" },
      });
      if (rows.length > 0) {
        const prices = rows.map(r => Number(r.price)).sort((a, b) => a - b);
        const top1 = prices[0];
        const top3 = prices.slice(0, Math.min(3, prices.length));
        const top3Avg = Math.round((top3.reduce((s, x) => s + x, 0) / top3.length) * 100) / 100;
        const currency = rows[0].currency || "EUR";

        await prisma.competitorSnapshot.upsert({
          where: { yachtId_weekStart_source: { yachtId: TARGET_YACHT_ID, weekStart, source: ScrapeSource.NAUSYS } },
          create: { yachtId: TARGET_YACHT_ID, weekStart, source: ScrapeSource.NAUSYS, top1Price: top1, top3Avg, currency, sampleSize: prices.length, rawStats: { prices } },
          update: { top1Price: top1, top3Avg, currency, sampleSize: prices.length, rawStats: { prices }, collectedAt: new Date() },
        });
        console.log("[5] snapshot updated:", { top1, top3Avg, sampleSize: prices.length });
      } else {
        console.log("[5] no prices to snapshot");
      }
    }

    await prisma.scrapeJob.update({ where: { id: job.id }, data: { status: JobStatus.DONE, finishedAt: new Date() } });
    console.log("✔ Done.");
  } catch (e: any) {
    console.error("Scan failed:", e?.message || e);
    await prisma.scrapeJob.update({ where: { id: job.id }, data: { status: JobStatus.FAILED, finishedAt: new Date(), error: String(e?.message || e) } });
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
main();


