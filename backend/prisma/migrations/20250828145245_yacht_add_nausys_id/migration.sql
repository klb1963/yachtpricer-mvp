/*
  Warnings:

  - A unique constraint covering the columns `[nausysId]` on the table `Yacht` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Yacht" ADD COLUMN     "nausysId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Yacht_nausysId_key" ON "public"."Yacht"("nausysId");
