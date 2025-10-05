-- AlterTable
ALTER TABLE "public"."yachts" ADD COLUMN     "builderId" INTEGER,
ADD COLUMN     "categoryId" INTEGER,
ADD COLUMN     "countryId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."yachts" ADD CONSTRAINT "yachts_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."yachts" ADD CONSTRAINT "yachts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."yacht_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."yachts" ADD CONSTRAINT "yachts_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "public"."yacht_builders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
