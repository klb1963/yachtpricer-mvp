/*
  Warnings:

  - You are about to drop the column `minRating` on the `competitor_filters` table. All the data in the column will be lost.
  - You are about to drop the column `pricePctRange` on the `competitor_filters` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "public"."ScrapeSource" ADD VALUE 'NAUSYS';

-- AlterTable
ALTER TABLE "public"."competitor_filters" DROP COLUMN "minRating",
DROP COLUMN "pricePctRange";
