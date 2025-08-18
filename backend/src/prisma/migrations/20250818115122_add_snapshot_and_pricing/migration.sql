-- CreateEnum
CREATE TYPE "public"."DecisionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."CompetitorSnapshot" (
    "id" TEXT NOT NULL,
    "yachtId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "source" "public"."ScrapeSource" NOT NULL,
    "top1Price" DECIMAL(65,30) NOT NULL,
    "top3Avg" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "rawStats" JSONB,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PricingDecision" (
    "id" TEXT NOT NULL,
    "yachtId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "basePrice" DECIMAL(65,30) NOT NULL,
    "top1" DECIMAL(65,30),
    "top3" DECIMAL(65,30),
    "mlReco" DECIMAL(65,30),
    "discountPct" DECIMAL(65,30),
    "finalPrice" DECIMAL(65,30),
    "status" "public"."DecisionStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "auditJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorSnapshot_yachtId_weekStart_source_key" ON "public"."CompetitorSnapshot"("yachtId", "weekStart", "source");

-- CreateIndex
CREATE UNIQUE INDEX "PricingDecision_yachtId_weekStart_key" ON "public"."PricingDecision"("yachtId", "weekStart");
