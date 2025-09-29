-- CreateTable
CREATE TABLE "public"."_FiltersRegions" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_FiltersRegions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_FiltersRegions_B_index" ON "public"."_FiltersRegions"("B");

-- AddForeignKey
ALTER TABLE "public"."_FiltersRegions" ADD CONSTRAINT "_FiltersRegions_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."competitor_filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_FiltersRegions" ADD CONSTRAINT "_FiltersRegions_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
