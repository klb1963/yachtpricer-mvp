/*
  Warnings:

  - A unique constraint covering the columns `[source,link,weekStart]` on the table `CompetitorPrice` will be added. If there are existing duplicate values, this will fail.
  - Made the column `link` on table `CompetitorPrice` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."CompetitorPrice" ADD COLUMN     "cabins" INTEGER,
ADD COLUMN     "discountPct" DECIMAL(65,30),
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "feesTotal" DECIMAL(65,30),
ADD COLUMN     "heads" INTEGER,
ADD COLUMN     "lengthFt" DOUBLE PRECISION,
ADD COLUMN     "marina" TEXT,
ADD COLUMN     "scrapeJobId" TEXT,
ADD COLUMN     "year" INTEGER,
ALTER COLUMN "currency" DROP DEFAULT,
ALTER COLUMN "link" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."ScrapeJob" ALTER COLUMN "status" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorPrice_source_link_weekStart_key" ON "public"."CompetitorPrice"("source", "link", "weekStart");

-- AddForeignKey
ALTER TABLE "public"."CompetitorPrice" ADD CONSTRAINT "CompetitorPrice_scrapeJobId_fkey" FOREIGN KEY ("scrapeJobId") REFERENCES "public"."ScrapeJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
