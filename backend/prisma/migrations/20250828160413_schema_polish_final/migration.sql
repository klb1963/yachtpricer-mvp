/*
  Warnings:

  - You are about to drop the column `currentDiscount` on the `yachts` table. All the data in the column will be lost.
  - You are about to drop the column `currentPrice` on the `yachts` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `yachts` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `yachts` table. All the data in the column will be lost.
  - You are about to drop the column `yachtId` on the `yachts` table. All the data in the column will be lost.
  - You are about to drop the `CompetitorPrice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CompetitorSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExtraServiceHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Owner` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PriceHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PricingDecision` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ScrapeJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Yacht` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[nausysId]` on the table `yachts` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `basePrice` to the `yachts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `builtYear` to the `yachts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cabins` to the `yachts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `charterCompany` to the `yachts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currentExtraServices` to the `yachts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fleet` to the `yachts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `heads` to the `yachts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `length` to the `yachts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `location` to the `yachts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `manufacturer` to the `yachts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `model` to the `yachts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `yachts` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."CompetitorPrice" DROP CONSTRAINT "CompetitorPrice_scrapeJobId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CompetitorPrice" DROP CONSTRAINT "CompetitorPrice_yachtId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CompetitorSnapshot" DROP CONSTRAINT "CompetitorSnapshot_yachtId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ExtraServiceHistory" DROP CONSTRAINT "ExtraServiceHistory_yachtId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PriceHistory" DROP CONSTRAINT "PriceHistory_weekSlotId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PricingDecision" DROP CONSTRAINT "PricingDecision_yachtId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Yacht" DROP CONSTRAINT "Yacht_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."yachts" DROP CONSTRAINT "yachts_yachtId_fkey";

-- DropIndex
DROP INDEX "public"."yachts_yachtId_startDate_key";

-- AlterTable
ALTER TABLE "public"."yachts" DROP COLUMN "currentDiscount",
DROP COLUMN "currentPrice",
DROP COLUMN "startDate",
DROP COLUMN "status",
DROP COLUMN "yachtId",
ADD COLUMN     "basePrice" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "builtYear" INTEGER NOT NULL,
ADD COLUMN     "cabins" INTEGER NOT NULL,
ADD COLUMN     "charterCompany" TEXT NOT NULL,
ADD COLUMN     "currentExtraServices" JSONB NOT NULL,
ADD COLUMN     "fleet" TEXT NOT NULL,
ADD COLUMN     "heads" INTEGER NOT NULL,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "length" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "location" TEXT NOT NULL,
ADD COLUMN     "manufacturer" TEXT NOT NULL,
ADD COLUMN     "model" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "nausysId" TEXT,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "type" "public"."YachtType" NOT NULL DEFAULT 'monohull';

-- DropTable
DROP TABLE "public"."CompetitorPrice";

-- DropTable
DROP TABLE "public"."CompetitorSnapshot";

-- DropTable
DROP TABLE "public"."ExtraServiceHistory";

-- DropTable
DROP TABLE "public"."Owner";

-- DropTable
DROP TABLE "public"."PriceHistory";

-- DropTable
DROP TABLE "public"."PricingDecision";

-- DropTable
DROP TABLE "public"."ScrapeJob";

-- DropTable
DROP TABLE "public"."Yacht";

-- CreateTable
CREATE TABLE "public"."owners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."week_slots" (
    "id" TEXT NOT NULL,
    "yachtId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."WeekSlotStatus" NOT NULL,
    "currentPrice" DECIMAL(12,2) NOT NULL,
    "currentDiscount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "week_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."price_history" (
    "id" TEXT NOT NULL,
    "weekSlotId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "authorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."extra_service_history" (
    "id" TEXT NOT NULL,
    "yachtId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serviceName" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extra_service_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."competitor_prices" (
    "id" TEXT NOT NULL,
    "yachtId" TEXT,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "source" "public"."ScrapeSource" NOT NULL,
    "competitorYacht" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,
    "scrapeJobId" TEXT,
    "externalId" TEXT,
    "year" INTEGER,
    "cabins" INTEGER,
    "heads" INTEGER,
    "lengthFt" DOUBLE PRECISION,
    "marina" TEXT,
    "discountPct" DECIMAL(12,2),
    "feesTotal" DECIMAL(12,2),

    CONSTRAINT "competitor_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scrape_jobs" (
    "id" TEXT NOT NULL,
    "source" "public"."ScrapeSource" NOT NULL,
    "status" "public"."JobStatus" NOT NULL,
    "params" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "scrape_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."competitor_snapshots" (
    "id" TEXT NOT NULL,
    "yachtId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "source" "public"."ScrapeSource" NOT NULL,
    "top1Price" DECIMAL(12,2) NOT NULL,
    "top3Avg" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "rawStats" JSONB,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pricing_decisions" (
    "id" TEXT NOT NULL,
    "yachtId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "top1" DECIMAL(12,2),
    "top3" DECIMAL(12,2),
    "mlReco" DECIMAL(12,2),
    "discountPct" DECIMAL(12,2),
    "finalPrice" DECIMAL(12,2),
    "status" "public"."DecisionStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "auditJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "owners_email_key" ON "public"."owners"("email");

-- CreateIndex
CREATE INDEX "week_slots_yachtId_startDate_idx" ON "public"."week_slots"("yachtId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "week_slots_yachtId_startDate_key" ON "public"."week_slots"("yachtId", "startDate");

-- CreateIndex
CREATE INDEX "competitor_prices_weekStart_source_idx" ON "public"."competitor_prices"("weekStart", "source");

-- CreateIndex
CREATE INDEX "competitor_prices_yachtId_weekStart_source_idx" ON "public"."competitor_prices"("yachtId", "weekStart", "source");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_prices_source_link_weekStart_key" ON "public"."competitor_prices"("source", "link", "weekStart");

-- CreateIndex
CREATE INDEX "competitor_snapshots_yachtId_weekStart_idx" ON "public"."competitor_snapshots"("yachtId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_snapshots_yachtId_weekStart_source_key" ON "public"."competitor_snapshots"("yachtId", "weekStart", "source");

-- CreateIndex
CREATE INDEX "pricing_decisions_weekStart_idx" ON "public"."pricing_decisions"("weekStart");

-- CreateIndex
CREATE INDEX "pricing_decisions_status_idx" ON "public"."pricing_decisions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_decisions_yachtId_weekStart_key" ON "public"."pricing_decisions"("yachtId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "yachts_nausysId_key" ON "public"."yachts"("nausysId");

-- CreateIndex
CREATE INDEX "yachts_manufacturer_model_idx" ON "public"."yachts"("manufacturer", "model");

-- CreateIndex
CREATE INDEX "yachts_location_idx" ON "public"."yachts"("location");

-- AddForeignKey
ALTER TABLE "public"."yachts" ADD CONSTRAINT "yachts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."week_slots" ADD CONSTRAINT "week_slots_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_history" ADD CONSTRAINT "price_history_weekSlotId_fkey" FOREIGN KEY ("weekSlotId") REFERENCES "public"."week_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."extra_service_history" ADD CONSTRAINT "extra_service_history_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_prices" ADD CONSTRAINT "competitor_prices_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_prices" ADD CONSTRAINT "competitor_prices_scrapeJobId_fkey" FOREIGN KEY ("scrapeJobId") REFERENCES "public"."scrape_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_snapshots" ADD CONSTRAINT "competitor_snapshots_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pricing_decisions" ADD CONSTRAINT "pricing_decisions_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
