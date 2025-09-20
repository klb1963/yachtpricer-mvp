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
  // Берём только NAUSYS-локации
  const locs = await prisma.location.findMany({
    where: { source: LocationSource.NAUSYS },
    select: { id: true, name: true },
  });

  let ok = 0, dup = 0, skip = 0, err = 0;

  for (const l of locs) {
    const rawName = l.name?.trim() || "";
    if (!rawName) { skip++; continue; }

    // Кандидаты: само имя + варианты
    const candidates = new Set<string>([
      rawName,
      rawName.replace(/,.*$/, "").trim(),
      rawName.replace(/\s*[-/–]\s*.*/, "").trim(),
    ]);

    for (const alias of candidates) {
      const normalized = normalizeAlias(alias);
      if (!normalized) { skip++; continue; }

      try {
        await prisma.locationAlias.create({
          data: { alias, normalized, locationId: l.id },
        });
        ok++;
      } catch (e: any) {
        if (e.code === "P2002") {
          dup++;
        } else {
          err++;
          console.error("Alias create error:", e);
        }
      }
    }
  }

  console.log(
    `done. locs: ${locs.length}, ok: ${ok}, dup: ${dup}, skipped: ${skip}, errors: ${err}`
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => prisma.$disconnect());