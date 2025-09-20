import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const NAUSYS_URL = "https://ws.nausys.com/CBMS-external/rest/catalogue/v6/countries";
const USERNAME = process.env.NAUSYS_USERNAME || "rest388@TTTTT";
const PASSWORD = process.env.NAUSYS_PASSWORD || "e2THubBC";

type NauCountry = {
  id: number;
  code2: string;
  code?: string | null;
  name?: { textEN?: string } | null;
};

type CountriesResponse = { countries: NauCountry[] };

async function fetchCountries(): Promise<NauCountry[]> {
  const r = await fetch(NAUSYS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!r.ok) throw new Error("countries HTTP " + r.status);

  const j: any = await r.json();
  if (!j || !Array.isArray(j.countries)) throw new Error("Bad countries payload");
  return j.countries as NauCountry[];
}

async function main() {
  const list = await fetchCountries();
  console.log("Countries fetched:", list.length);

  for (const c of list) {
    await prisma.country.upsert({
      where: { nausysId: c.id },
      update: {
        code2: c.code2,
        code3: c.code || null,
        name: c?.name?.textEN ?? "",
      },
      create: {
        nausysId: c.id,
        code2: c.code2,
        code3: c.code || null,
        name: c?.name?.textEN ?? "",
      },
    });
  }
  console.log("Countries upsert done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => prisma.$disconnect());
  