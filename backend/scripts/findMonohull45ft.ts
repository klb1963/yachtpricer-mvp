// backend/scripts/findMonohull45ft.ts
// Запуск:
// docker compose exec \
//   -e NAUSYS_USERNAME="..." \
//   -e NAUSYS_PASSWORD="..." \
//   -e TS_NODE_TRANSPILE_ONLY=1 \
//   backend npx ts-node prisma/findMonohull45ft.ts

const BASE = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6";

const USERNAME = process.env.NAUSYS_USERNAME || "";
const PASSWORD = process.env.NAUSYS_PASSWORD || "";

const COMPANY_ID = 102701;       // “подопытный кролик”
const TARGET_FT = 45;
const TOL_FT = 2;
const MIN_FT = TARGET_FT - TOL_FT;
const MAX_FT = TARGET_FT + TOL_FT;

type NauName = { textEN?: string | null; [k: string]: string | undefined };

// ---- generic POST helper
async function post<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD, ...body }),
  });
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return (await r.json()) as T;
}

// ---- utils
const mToFt = (m: number) => m * 3.28084;

function readNumber(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = parseFloat(x);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// Пытаемся извлечь длину (LOA) из разных возможных полей.
// Если значение < 25 — скорее всего метры -> конвертим в футы; иначе — уже футы.
function getLoaFt(model: any): number | null {
  const candidates = [
    model.lengthFt, model.lengthInFeet, model.length_feet,
    model.loaFt, model.loa_feet, model.loaFeet,
    model.length, model.loa, model.LOA, model.hullLength,
  ];

  for (const c of candidates) {
    const v = readNumber(c);
    if (v == null) continue;
    if (v < 25) return mToFt(v);    // выглядит как метры
    return v;                       // выглядит как футы
  }
  return null;
}

// Пытаемся понять, не мультихул ли (catamaran/trimaran)
function isMultiHull(model: any): boolean {
  const texts: string[] = [];
  const push = (v: unknown) => typeof v === "string" && texts.push(v.toLowerCase());

  push(model?.hullType);
  push(model?.type);
  push(model?.yachtType);
  push(model?.category);
  push(model?.class);
  push(model?.name);
  push(model?.model);
  // Иногда бывает { name: { textEN: "…" } }
  if (model?.name && typeof model.name === "object") {
    const t = (model.name as NauName).textEN;
    if (t) texts.push(String(t).toLowerCase());
  }

  const joined = texts.join(" ");
  if (!joined) return false;
  return joined.includes("cata") || joined.includes("trimaran") || joined.includes("multi");
}

async function main() {
  if (!USERNAME || !PASSWORD) {
    throw new Error("Missing NAUSYS_USERNAME / NAUSYS_PASSWORD env vars.");
  }

  // 1) все яхты компании → берём их модельные ID
  const yachtsRes = await post<any>(`${BASE}/yachts/${COMPANY_ID}`, {});
  const yachts = Array.isArray(yachtsRes?.yachts) ? yachtsRes.yachts : [];
  console.log(`Company ${COMPANY_ID} → yachts total: ${yachts.length}`);

  const modelIds = Array.from(new Set(yachts.map((y: any) => y?.yachtModelId).filter(Boolean)));
  console.log(`Unique yachtModelId(s): ${modelIds.length}`);

  if (modelIds.length === 0) {
    console.log("No models to fetch.");
    return;
  }

  // 2) тянем модели батчами по 50
  const batchSize = 50;
  const models: any[] = [];
  for (let i = 0; i < modelIds.length; i += batchSize) {
    const batch = modelIds.slice(i, i + batchSize);
    const res = await post<any>(`${BASE}/yachtModels`, { yachtModelIDs: batch });
    const got = Array.isArray(res?.yachtModels) ? res.yachtModels : [];
    models.push(...got);
  }
  console.log(`Fetched models: ${models.length}`);

  // 3) фильтруем “monohull 45ft ±2ft”
  const matched = models
    .map((m) => {
      const ft = getLoaFt(m);
      return { model: m, ft, multihull: isMultiHull(m) };
    })
    .filter((x) => x.ft != null && x.ft >= MIN_FT && x.ft <= MAX_FT && !x.multihull);

  console.log(`Matched monohull models around ${TARGET_FT} ft: ${matched.length}`);

  if (matched.length === 0) {
    console.log("No models matched the criteria. Consider widening tolerance or checking type heuristics.");
    // Для диагностики выведем 2-3 модели с ближайшей длиной
    const withFt = models
      .map((m) => ({ m, ft: getLoaFt(m) }))
      .filter((x) => x.ft != null)
      .sort((a, b) => Math.abs((a.ft ?? 0) - TARGET_FT) - Math.abs((b.ft ?? 0) - TARGET_FT))
      .slice(0, 5);
    console.log("Closest by LOA (diagnostic):");
    withFt.forEach((x, i) => console.log(i + 1, "→", { ft: x.ft, id: x.m?.id, name: x.m?.name?.textEN ?? x.m?.name }));
    return;
  }

  // 4) выводим топ-10
  matched.slice(0, 10).forEach((x, i) => {
    const name = x.model?.name?.textEN ?? x.model?.name ?? `model:${x.model?.id}`;
    console.log(`${i + 1}. ${name} — LOA≈${x.ft?.toFixed(1)} ft; id=${x.model?.id}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});