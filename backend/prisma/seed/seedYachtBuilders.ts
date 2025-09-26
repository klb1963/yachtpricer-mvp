import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NAUSYS_URL = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/yachtBuilders";
const USERNAME = process.env.NAUSYS_USERNAME || "rest388@TTTTT";
const PASSWORD = process.env.NAUSYS_PASSWORD || "e2THubBC";

type NauBuilder = {
  id: number;
  name: string;
};

type BuildersResponse = {
  status: string;
  builders: NauBuilder[];
};

// универсальный helper, чистит текст от «мусора» NauSYS
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
  const j = await fetchCleanJson<BuildersResponse>(NAUSYS_URL, payload);

  if (!j.builders || !Array.isArray(j.builders)) {
    throw new Error("Bad builders payload");
  }

  console.log("Builders fetched:", j.builders.length);

  for (const b of j.builders) {
    await prisma.yachtBuilder.upsert({
      where: { nausysId: b.id },
      update: { name: b.name },
      create: {
        nausysId: b.id,
        name: b.name,
      },
    });
  }

  console.log("Builders upsert done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());