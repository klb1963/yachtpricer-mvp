/*
  Warnings:

  - A unique constraint covering the columns `[yachtId,startDate]` on the table `WeekSlot` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "WeekSlot_yachtId_startDate_key" ON "public"."WeekSlot"("yachtId", "startDate");
