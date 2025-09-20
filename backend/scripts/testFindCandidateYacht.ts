// backend/scripts/testCompanyYachts.ts
// Запуск из контейнера:
// docker compose exec -e NAUSYS_USERNAME="..." -e NAUSYS_PASSWORD="..." backend \
//   npx ts-node prisma/testCompanyYachts.ts 102701

const USERNAME = process.env.NAUSYS_USERNAME || "";
const PASSWORD = process.env.NAUSYS_PASSWORD || "";

const BASE_URL =
  "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/yachts";

type NauName = {
  [k: string]: string | null | undefined;
  textEN?: string | null;
};

type RestYacht = {
  id: number;
  name?: string | NauName;
  companyId?: number;
  baseId?: number;
  locationId?: number;
  buildYear?: number;
  cabins?: number;
  wc?: number;
  mainPictureUrl?: string;
  // ...много других полей, но для теста не нужны
};

type RestYachtList = {
  status?: string;
  yachtIDs?: number[];
  yachts?: RestYacht[];
};

function getCompanyId(): number {
  const arg = process.argv[2];
  const envId = process.env.NAUSYS_COMPANY_ID;
  const v = arg ?? envId ?? "102701";
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`Bad companyId: ${v}`);
  }
  return n;
}

function safeName(n?: string | NauName): string {
  if (!n) return "";
  if (typeof n === "string") return n;
  const t = n.textEN?.trim();
  return t || "";
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return (await r.json()) as T;
}

async function main() {
  if (!USERNAME || !PASSWORD) {
    throw new Error("Missing NAUSYS_USERNAME / NAUSYS_PASSWORD env vars.");
  }

  const companyId = getCompanyId();
  const url = `${BASE_URL}/${companyId}`;

  const payload = {
    username: USERNAME,
    password: PASSWORD,
    // Опционально можно сузить до конкретных яхт:
    // yachtIDs: [103152, 103151],
  };

  const res = await post<RestYachtList>(url, payload);
  const yachts = Array.isArray(res.yachts) ? res.yachts : [];

  console.log(`Company ${companyId} → yachts total:`, yachts.length);

  // Печатаем первые 10
  yachts.slice(0, 10).forEach((y, i) => {
    console.log(
      `${i + 1}. id=${y.id} name="${safeName(y.name)}" ` +
        `year=${y.buildYear ?? "-"} cabins=${y.cabins ?? "-"} wc=${y.wc ?? "-"} ` +
        `loc=${y.locationId ?? "-"}`
    );
    if (y.mainPictureUrl) {
      // Хитрость из доки: можно добавить ?w=600 или &h=… для ресайза
      const resized = y.mainPictureUrl.includes("?")
        ? `${y.mainPictureUrl}&w=600`
        : `${y.mainPictureUrl}?w=600`;
      console.log(`   pic: ${resized}`);
    }
  });

  if (yachts.length === 0) {
    console.log(
      "Empty list. Проверьте правильность companyId или попробуйте другую компанию."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});