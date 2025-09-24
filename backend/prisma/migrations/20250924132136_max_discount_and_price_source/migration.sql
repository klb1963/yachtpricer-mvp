/*
  Warnings:

  - You are about to alter the column `currentDiscount` on the `week_slots` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(5,2)`.

*/
-- CreateEnum
CREATE TYPE "public"."PriceSource" AS ENUM ('INTERNAL', 'NAUSYS', 'BOOKING_MANAGER', 'OTHER');

-- AlterTable
ALTER TABLE "public"."price_history" ADD COLUMN     "source" "public"."PriceSource";

-- AlterTable
ALTER TABLE "public"."week_slots" ADD COLUMN     "priceFetchedAt" TIMESTAMP(3),
ADD COLUMN     "priceSource" "public"."PriceSource",
ALTER COLUMN "currentDiscount" SET DATA TYPE DECIMAL(5,2);

-- AlterTable
ALTER TABLE "public"."yachts" ADD COLUMN     "maxDiscountPct" DECIMAL(5,2);
