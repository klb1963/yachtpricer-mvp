// backend/scripts/testAquatoriaYachts.ts
/* 
  Usage (inside container):
    NAUSYS_USERNAME=... NAUSYS_PASSWORD=... npx ts-node scripts/testAquatoriaYachts.ts
  Optional:
    SEARCH="Aquatoria Group" npx ts-node scripts/testAquatoriaYachts.ts
*/

type NauName = { textEN?: string | null } | string | null | undefined;

type Company = {
  id: number;
  name?: NauName;
};

type CompaniesResponse = {
  charterCompanies?: Company[];
  status?: string;
};

type Yacht = {
  id: number;
  name?: NauName;
  model?: NauName;
  manufacturer?: NauName;
  year?: number;
  builtYear?: number;
  length?: number;      // иногда так
  lengthFeet?: number;  // иногда так
  cabins?: number;
  yachtType?: string | null;
};

type YachtsResponse = {
  yachts?: Yacht[];
  status?: string;
};

const BASE = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6";
const COMP_URL = `${BASE}/charterCompanies`;
const YACHTS_URL = `${BASE}/yachts`;

const USERNAME = process.env.NAUSYS_USERNAME || "";
const PASSWORD = process.env.NAUSYS_PASSWORD || "";
const SEARCH = (process.env.SEARCH || "Aquatoria").toString().trim();

function nameToStr(n: NauName): string {
  if (!n) return "";
  if (typeof n === "string") return n;
  return (n.textEN ?? "").trim();
}

async function postJSON<T>(url: string, extra: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD, ...extra }),
  });
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return (await r.json()) as T;
}

async function main() {
  if (!USERNAME || !PASSWORD) {
    console.error("Missing NAUSYS_USERNAME / NAUSYS_PASSWORD env vars.");
    process.exit(1);
  }

  // 1) Companies
  const compRes = await postJSON<CompaniesResponse>(COMP_URL);
  const companies = Array.isArray(compRes?.charterCompanies) ? compRes.charterCompanies : [];
  if (companies.length === 0) {
    throw new Error("No companies in response.");
  }

  const matches = companies
    .map(c => ({ ...c, _name: nameToStr(c.name) }))
    .filter(c => c._name.toLowerCase().includes(SEARCH.toLowerCase()));

  if (matches.length === 0) {
    console.log(`No companies matched by "${SEARCH}". Total companies: ${companies.length}`);
    // Подсказываем 5 ближайших по названию
    console.log("First 5 companies for reference:");
    companies.slice(0, 5).forEach(c => console.log(`- [${c.id}] ${nameToStr(c.name)}`));
    return;
  }

  if (matches.length > 1) {
    console.log(`Matched ${matches.length} companies by "${SEARCH}". Showing all:`);
    matches.forEach(c => console.log(`- [${c.id}] ${c._name}`));
  }

  const target = matches[0];
  console.log(`\n→ Using company: [${target.id}] ${target._name}`);

  // 2) Yachts of that company
  const yRes = await postJSON<YachtsResponse>(YACHTS_URL, { charterCompanyId: target.id });
  const yachts = Array.isArray(yRes?.yachts) ? yRes.yachts : [];
  console.log(`Yachts fetched: ${yachts.length}`);

  // Show sample 10
  const sample = yachts.slice(0, 10).map(y => {
    const len = y.length ?? y.lengthFeet ?? null;
    const year = y.builtYear ?? y.year ?? null;
    return {
      id: y.id,
      name: nameToStr(y.name),
      model: nameToStr(y.model) || nameToStr(y.manufacturer),
      year,
      length: len,
      cabins: y.cabins ?? null,
      type: y.yachtType ?? null,
    };
  });

  console.log("Sample (first 10):");
  console.table(sample);

  // Подсчёт по типам для понимания состава флота
  const byType = new Map<string, number>();
  for (const y of yachts) {
    const t = (y.yachtType || "UNKNOWN").toString();
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }
  console.log("\nBy type:");
  for (const [t, n] of byType) {
    console.log(`  ${t}: ${n}`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});