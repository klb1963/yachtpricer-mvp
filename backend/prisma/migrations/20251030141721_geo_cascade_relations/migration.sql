-- AlterTable
ALTER TABLE "public"."locations" ADD COLUMN     "countryId" TEXT,
ADD COLUMN     "regionId" INTEGER;

-- AlterTable
ALTER TABLE "public"."regions" ADD COLUMN     "countryId" TEXT;

-- CreateIndex
CREATE INDEX "locations_regionId_idx" ON "public"."locations"("regionId");

-- CreateIndex
CREATE INDEX "locations_countryId_idx" ON "public"."locations"("countryId");

-- CreateIndex
CREATE INDEX "regions_countryId_idx" ON "public"."regions"("countryId");

-- AddForeignKey
ALTER TABLE "public"."regions" ADD CONSTRAINT "regions_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "public"."regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
