/*
  Warnings:

  - You are about to drop the `WeekSlot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."PriceHistory" DROP CONSTRAINT "PriceHistory_weekSlotId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WeekSlot" DROP CONSTRAINT "WeekSlot_yachtId_fkey";

-- DropTable
DROP TABLE "public"."WeekSlot";

-- CreateTable
CREATE TABLE "public"."yachts" (
    "id" TEXT NOT NULL,
    "yachtId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."WeekSlotStatus" NOT NULL,
    "currentPrice" DECIMAL(65,30) NOT NULL,
    "currentDiscount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yachts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "yachts_yachtId_startDate_key" ON "public"."yachts"("yachtId", "startDate");

-- AddForeignKey
ALTER TABLE "public"."yachts" ADD CONSTRAINT "yachts_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."Yacht"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PriceHistory" ADD CONSTRAINT "PriceHistory_weekSlotId_fkey" FOREIGN KEY ("weekSlotId") REFERENCES "public"."yachts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
