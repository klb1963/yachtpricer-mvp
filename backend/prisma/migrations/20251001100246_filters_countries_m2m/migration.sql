-- CreateTable
CREATE TABLE "public"."_FiltersCountries" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FiltersCountries_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_FiltersCountries_B_index" ON "public"."_FiltersCountries"("B");

-- AddForeignKey
ALTER TABLE "public"."_FiltersCountries" ADD CONSTRAINT "_FiltersCountries_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."competitor_filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_FiltersCountries" ADD CONSTRAINT "_FiltersCountries_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
