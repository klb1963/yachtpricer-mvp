// /workspace/backend/prisma/seed/nausysLocations.ts

import { execFileSync } from "child_process";
import { PrismaClient, LocationSource } from "@prisma/client";

/** ENV NauSYS */
const USER = process.env.NAUSYS_USERNAME || "";
const PASS = process.env.NAUSYS_PASSWORD || "";
if (!USER || !PASS) {
  console.error("Missing NAUSYS_USERNAME / NAUSYS_PASSWORD in env");
  process.exit(1);
}

/** NauSYS catalogue endpoints */
const URL_BASES   = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/charterBases";
const URL_LOC     = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/locations";
const URL_REGIONS = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/regions";
const URL_COUNTRY = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/countries";

/** curl -> JSON */
function curlJson<T>(url: string, body: Record<string, unknown>): T {
  const payload = JSON.stringify({ username: USER, password: PASS, ...body });
  const out = execFileSync(
    "curl",
    ["-sS", "-X", "POST", url, "-H", "Content-Type: application/json", "-d", payload],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  try {
    return JSON.parse(out) as T;
  } catch {
    const clean = out.replace(/[\u0000-\u001F]/g, "");
    return JSON.parse(clean) as T;
  }
}

type LangMap = { [k: string]: string | undefined };

type CharterBase = {
  id: number;
  locationId: number;
  companyId: number;
  disabled?: boolean;
  lat?: number;
  lon?: number;
};

type LocationDTO = {
  id: number;
  lat?: number;
  lon?: number;
  name?: LangMap;
  regionId?: number;
};

type RegionDTO = { id: number; countryId: number };
type CountryDTO = { id: number; code2: string };

function chunk<T>(arr: T[], size = 400): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

function pickNameEN(m?: LangMap): string {
  if (!m) return "";
  return (
    m.textEN ||
    m.textFR ||
    m.textDE ||
    m.textES ||
    m.textIT ||
    Object.values(m).find(Boolean) ||
    ""
  );
}

function normalizeAlias(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

(async () => {
  const prisma = new PrismaClient();
  try {
    // 1) Базы → locationIds (+ lat/lon)
    const basesResp = curlJson<{ status: string; bases: CharterBase[] }>(URL_BASES, {});
    const bases = (basesResp?.bases || []).filter(b => !b.disabled);
    const locIds = Array.from(new Set(bases.map(b => b.locationId))).sort((a, b) => a - b);
    console.log(`Bases: ${bases.length}, unique locationIds: ${locIds.length}`);

    // 2) Локации по батчам
    const allLocations: LocationDTO[] = [];
    for (const part of chunk(locIds, 400)) {
      const resp = curlJson<{ status: string; locations: LocationDTO[] }>(URL_LOC, { locationIds: part });
      const got = resp?.locations || [];
      allLocations.push(...got);
      console.log(`  +${got.length} locations (total=${allLocations.length})`);
    }

    // 3) Регионы -> страны
    const regionIds = Array.from(new Set(allLocations.map(l => l.regionId).filter(Boolean))) as number[];
    const allRegions: RegionDTO[] = [];
    for (const part of chunk(regionIds, 500)) {
      const resp = curlJson<{ status: string; regions: RegionDTO[] }>(URL_REGIONS, { regionIds: part });
      const got = resp?.regions || [];
      allRegions.push(...got);
      console.log(`  +${got.length} regions (total=${allRegions.length})`);
    }
    const countriesResp = curlJson<{ status: string; countries: CountryDTO[] }>(URL_COUNTRY, {});
    const countries = countriesResp?.countries || [];

    // мапы
    const regionToCountry = new Map<number, number>(allRegions.map(r => [r.id, r.countryId]));
    const countryIdToCode = new Map<number, string>(countries.map(c => [c.id, c.code2]));
    const locIdToBase     = new Map<number, CharterBase>();
    for (const b of bases) if (!locIdToBase.has(b.locationId)) locIdToBase.set(b.locationId, b);

    // 4) Запись в БД
    let upserts = 0;
    let aliasCount = 0;

    for (const loc of allLocations) {
      const base = locIdToBase.get(loc.id);
      const name = pickNameEN(loc.name) || `Location ${loc.id}`;
      const lat  = (base?.lat ?? loc.lat) ?? null;
      const lon  = (base?.lon ?? loc.lon) ?? null;

      const regId = loc.regionId;
      const countryId = regId ? regionToCountry.get(regId) : undefined;
      const countryCode = countryId ? (countryIdToCode.get(countryId) ?? null) : null;

      const saved = await prisma.location.upsert({
        where: { source_externalId: { source: LocationSource.NAUSYS, externalId: String(loc.id) } },
        create: {
          source: LocationSource.NAUSYS,
          externalId: String(loc.id),
          code: null,
          name,
          countryCode,
          lat,
          lon,
          parentId: null
        },
        update: { name, countryCode, lat, lon },
        select: { id: true }
      });
      upserts++;

      const aliases = new Set<string>();
      if (loc.name) for (const v of Object.values(loc.name)) if (v) aliases.add(v);
      if (aliases.size) {
        const rows = Array.from(aliases).map(a => ({
          alias: a,
          normalized: normalizeAlias(a),
          locationId: saved.id
        }));
        await prisma.locationAlias.createMany({ data: rows, skipDuplicates: true });
        aliasCount += rows.length;
      }
    }

    console.log(`DONE: upserted locations=${upserts}, aliases inserted (attempted)=${aliasCount}`);
  } catch (e: any) {
    console.error("ERROR:", e?.message || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();