-- CreateEnum
CREATE TYPE "public"."YachtType" AS ENUM ('monohull', 'catamaran', 'trimaran', 'compromis');

-- CreateEnum
CREATE TYPE "public"."ScrapeSource" AS ENUM ('BOATAROUND', 'SEARADAR');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "public"."Yacht" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "ownerName" TEXT;

-- CreateTable
CREATE TABLE "public"."CompetitorPrice" (
    "id" TEXT NOT NULL,
    "yachtId" TEXT,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "source" "public"."ScrapeSource" NOT NULL,
    "competitorYacht" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "link" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,

    CONSTRAINT "CompetitorPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScrapeJob" (
    "id" TEXT NOT NULL,
    "source" "public"."ScrapeSource" NOT NULL,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'PENDING',
    "params" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "ScrapeJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetitorPrice_yachtId_weekStart_source_idx" ON "public"."CompetitorPrice"("yachtId", "weekStart", "source");

-- CreateIndex
CREATE INDEX "CompetitorPrice_weekStart_source_idx" ON "public"."CompetitorPrice"("weekStart", "source");

-- AddForeignKey
ALTER TABLE "public"."CompetitorPrice" ADD CONSTRAINT "CompetitorPrice_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."Yacht"("id") ON DELETE SET NULL ON UPDATE CASCADE;
