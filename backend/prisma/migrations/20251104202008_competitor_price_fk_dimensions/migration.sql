-- AlterTable
ALTER TABLE "public"."competitor_prices" ADD COLUMN     "builderId" INTEGER,
ADD COLUMN     "categoryId" INTEGER,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "modelId" INTEGER,
ADD COLUMN     "regionId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."competitor_prices" ADD CONSTRAINT "competitor_prices_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."yacht_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_prices" ADD CONSTRAINT "competitor_prices_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "public"."regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_prices" ADD CONSTRAINT "competitor_prices_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_prices" ADD CONSTRAINT "competitor_prices_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "public"."yacht_builders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_prices" ADD CONSTRAINT "competitor_prices_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "public"."yacht_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
