-- AlterTable
ALTER TABLE "public"."yachts" ADD COLUMN     "yachtModelId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."yachts" ADD CONSTRAINT "yachts_yachtModelId_fkey" FOREIGN KEY ("yachtModelId") REFERENCES "public"."yacht_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
