// backend/prisma/seed/seedLocations.ts
import { PrismaClient, LocationSource } from "@prisma/client";

const prisma = new PrismaClient();

const BASES_URL = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/charterBases";
const LOCS_URL  = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/locations";
const REGS_URL  = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/regions";
const CNTS_URL  = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/countries";

const USERNAME = process.env.NAUSYS_USERNAME || "rest388@TTTTT";
const PASSWORD = process.env.NAUSYS_PASSWORD || "e2THubBC";

type NauName = { textEN?: string | null; [k: string]: string | undefined };
type NauBase = { id: number; locationId: number; lat?: number; lon?: number };
type NauLoc  = { id: number; name?: NauName; lat?: number; lon?: number; regionId?: number };
type NauReg  = { id: number; countryId: number };
type NauCnt  = { id: number; code2: string };

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD, ...((body ?? {}) as object) }),
  });
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

async function main() {
  // 1) bases -> set of locationIds
  const basesRes = await post<{ status: string; bases: NauBase[] }>(BASES_URL, {});
  const locIdSet = new Set(basesRes?.bases?.map(b => b.locationId.toString()));
  console.log("Bases:", basesRes.bases?.length ?? 0, "unique locationIds:", locIdSet.size);

  // 2) countries & regions maps
  const cntsRes = await post<{ countries: NauCnt[] }>(CNTS_URL, {});
  const regRes  = await post<{ regions: NauReg[] }>(REGS_URL, {});
  const countryMap = new Map<number, string>(); // countryId -> code2
  cntsRes.countries.forEach(c => countryMap.set(c.id, c.code2));
  const regionToCountry = new Map<number, number>(); // regionId -> countryId
  regRes.regions.forEach(r => regionToCountry.set(r.id, r.countryId));

  // 3) all locations -> filter by needed ids
  const locsRes = await post<{ locations: NauLoc[] }>(LOCS_URL, {});
  const needed = locsRes.locations.filter(l => locIdSet.has(String(l.id)));

  console.log("Locations to upsert:", needed.length);

  // 4) upsert each
  let ok = 0, fail = 0;
  for (const l of needed) {
    try {
      const countryId = l.regionId ? regionToCountry.get(l.regionId) : undefined;
      const code2 = countryId ? countryMap.get(countryId) : undefined;

      await prisma.location.upsert({
        where: { source_externalId: { source: LocationSource.NAUSYS, externalId: String(l.id) } },
        update: {
          name: l?.name?.textEN ?? "",
          countryCode: code2 ?? null,
          lat: l.lat ?? null,
          lon: l.lon ?? null,
        },
        create: {
          source: LocationSource.NAUSYS,
          externalId: String(l.id),
          name: l?.name?.textEN ?? "",
          countryCode: code2 ?? null,
          lat: l.lat ?? null,
          lon: l.lon ?? null,
        },
      });
      ok++;
    } catch (e) {
      fail++;
      console.error("upsert fail for location", l.id, e);
    }
  }

  console.log(`Done. ok=${ok}, fail=${fail}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => prisma.$disconnect());