-- AlterTable
ALTER TABLE "public"."competitor_prices" ADD COLUMN     "countryId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."competitor_prices" ADD CONSTRAINT "competitor_prices_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
