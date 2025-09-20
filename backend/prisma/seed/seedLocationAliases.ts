// backend/prisma/seed/seedLocationAliases.ts
import { PrismaClient, LocationSource } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeAlias(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function main() {
  // берём NAUSYS-локации, чтобы не трогать прочие
  const locs = await prisma.location.findMany({
    where: { source: LocationSource.NAUSYS },
    select: { id: true, name: true },
  });

  let ok = 0, dup = 0, skip = 0, err = 0;

  for (const l of locs) {
    // набор алиасов по месту — базово: само EN имя + несколько простых вариантов
    const candidates = new Set<string>([
      l.name,
      l.name.replace(/,.*$/, "").trim(),       // без хвоста после запятой
      l.name.replace(/\s*[-/–]\s*.*/,'').trim() // до разделителей
    ]);
    for (const alias of candidates) {
      const normalized = normalizeAlias(alias);
      if (!normalized) { skip++; continue; }

      try {
        await prisma.locationAlias.create({
          data: {
            alias,
            normalized,
            locationId: l.id,
          },
        });
        ok++;
      } catch (e: any) {
        // уникальный normalized уже существует (на другой локации/той же)
        if (String(e?.message || "").includes("location_aliases_normalized_key")) {
          dup++;
        } else {
          err++;
          console.error("Alias create error:", e);
        }
      }
    }
  }

  console.log(`done. ok: ${ok}, dup: ${dup}, skipped: ${skip}, errors: ${err}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => prisma.$disconnect());