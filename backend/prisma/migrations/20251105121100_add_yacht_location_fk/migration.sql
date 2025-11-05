-- AlterTable
ALTER TABLE "public"."yachts" ADD COLUMN     "locationId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."yachts" ADD CONSTRAINT "yachts_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
