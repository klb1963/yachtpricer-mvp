// backend/prisma/seed/seedLocations.ts
import { PrismaClient, LocationSource } from "@prisma/client";

const prisma = new PrismaClient();

const BASES_URL = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/charterBases";
const LOCS_URL  = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/locations";
const REGS_URL  = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/regions";
const CNTS_URL  = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/countries";

const USERNAME = process.env.NAUSYS_USERNAME || "rest388@TTTTT";
const PASSWORD = process.env.NAUSYS_PASSWORD || "e2THubBC";

// ── Types from NauSYS
type NauName = { textEN?: string | null } & { [k: string]: string | null | undefined };
type NauBase = { id: number; locationId: number; lat?: number; lon?: number };
type NauLoc  = { id: number; name?: NauName; lat?: number; lon?: number; regionId?: number };
type NauReg  = { id: number; countryId: number };
type NauCnt  = { id: number; code2: string };

// ── Response shapes
type BasesResponse = { status?: string; bases?: NauBase[] };
type LocsResponse  = { status?: string; locations?: NauLoc[] };
type RegsResponse  = { status?: string; regions?: NauReg[] };
type CntsResponse  = { status?: string; countries?: NauCnt[] };

// ── helpers
async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: USERNAME,
      password: PASSWORD,
      ...(body && typeof body === "object" ? body : {}),
    }),
  });
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return (await r.json()) as T;
}

function normCode2(s?: string): string | null {
  const v = (s ?? "").trim().toUpperCase();
  return v.length === 2 ? v : null;
}

function safeName(n?: NauName): string {
  const t = n?.textEN?.trim();
  return t && t.length > 0 ? t : "";
}

function safeCoord(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

async function main() {
  // 1) charter bases → distinct locationIds actually used in bases
  const basesRes = await post<BasesResponse>(BASES_URL, {});
  const bases = Array.isArray(basesRes?.bases) ? basesRes.bases : [];
  const locIdSet = new Set<string>(bases.map((b) => String(b.locationId)));
  console.log("Bases:", bases.length, "unique locationIds:", locIdSet.size);

  if (locIdSet.size === 0) {
    console.warn("[seedLocations] No bases found → nothing to upsert.");
    return;
  }

  // 2) countries & regions maps
  const cntsRes = await post<CntsResponse>(CNTS_URL, {});
  const countries = Array.isArray(cntsRes?.countries) ? cntsRes.countries : [];
  if (countries.length === 0) console.warn("[seedLocations] Countries payload is empty.");

  const regRes = await post<RegsResponse>(REGS_URL, {});
  const regions = Array.isArray(regRes?.regions) ? regRes.regions : [];
  if (regions.length === 0) console.warn("[seedLocations] Regions payload is empty.");

  const countryMap = new Map<number, string>(); // countryId -> code2 (ISO-2)
  countries.forEach((c) => {
    const code2 = normCode2(c.code2);
    if (code2) countryMap.set(c.id, code2);
  });

  const regionToCountry = new Map<number, number>(); // regionId -> countryId
  regions.forEach((r) => regionToCountry.set(r.id, r.countryId));

  // 3) all locations → filter only those present in bases
  const locsRes = await post<LocsResponse>(LOCS_URL, {});
  const allLocs = Array.isArray(locsRes?.locations) ? locsRes.locations : [];
  const needed = allLocs.filter((l) => locIdSet.has(String(l.id)));

  console.log("Locations in payload:", allLocs.length, "→ to upsert:", needed.length);
  if (needed.length === 0) {
    console.warn("[seedLocations] No matching locations for bases → nothing to upsert.");
    return;
  }

  // 4) upsert each location
  let ok = 0, fail = 0;
  for (const l of needed) {
    try {
      const countryId = l.regionId ? regionToCountry.get(l.regionId) : undefined;
      const code2 = countryId ? normCode2(countryMap.get(countryId)) : null;

      await prisma.location.upsert({
        where: {
          // relies on @@unique([source, externalId]) → input alias is source_externalId
          source_externalId: {
            source: LocationSource.NAUSYS,
            externalId: String(l.id),
          },
        },
        update: {
          name: safeName(l.name),
          countryCode: code2,
          lat: safeCoord(l.lat),
          lon: safeCoord(l.lon),
        },
        create: {
          source: LocationSource.NAUSYS,
          externalId: String(l.id),
          name: safeName(l.name),
          countryCode: code2,
          lat: safeCoord(l.lat),
          lon: safeCoord(l.lon),
        },
      });
      ok++;
    } catch (e) {
      fail++;
      console.error("Upsert failed for location", l?.id, e);
    }
  }

  console.log("Done.", { ok, fail });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());