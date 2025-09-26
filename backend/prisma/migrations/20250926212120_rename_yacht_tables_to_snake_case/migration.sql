/*
  Warnings:

  - You are about to drop the `YachtBuilder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `YachtCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `YachtModel` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."YachtModel" DROP CONSTRAINT "YachtModel_builderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."YachtModel" DROP CONSTRAINT "YachtModel_categoryId_fkey";

-- DropTable
DROP TABLE "public"."YachtBuilder";

-- DropTable
DROP TABLE "public"."YachtCategory";

-- DropTable
DROP TABLE "public"."YachtModel";

-- CreateTable
CREATE TABLE "public"."yacht_categories" (
    "id" SERIAL NOT NULL,
    "nausysId" INTEGER NOT NULL,
    "names" JSONB NOT NULL,
    "name_en" TEXT,
    "name_de" TEXT,
    "name_ru" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yacht_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."yacht_builders" (
    "id" SERIAL NOT NULL,
    "nausysId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yacht_builders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."yacht_models" (
    "id" SERIAL NOT NULL,
    "nausysId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "builderId" INTEGER,
    "categoryId" INTEGER,
    "loa" DECIMAL(6,2),
    "beam" DECIMAL(5,2),
    "draft" DECIMAL(4,2),
    "cabins" INTEGER,
    "wc" INTEGER,
    "waterTank" INTEGER,
    "fuelTank" INTEGER,
    "displacement" INTEGER,
    "virtualLength" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yacht_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "yacht_categories_nausysId_key" ON "public"."yacht_categories"("nausysId");

-- CreateIndex
CREATE UNIQUE INDEX "yacht_builders_nausysId_key" ON "public"."yacht_builders"("nausysId");

-- CreateIndex
CREATE INDEX "yacht_builders_name_idx" ON "public"."yacht_builders"("name");

-- CreateIndex
CREATE UNIQUE INDEX "yacht_models_nausysId_key" ON "public"."yacht_models"("nausysId");

-- CreateIndex
CREATE INDEX "yacht_models_name_idx" ON "public"."yacht_models"("name");

-- CreateIndex
CREATE INDEX "yacht_models_builderId_idx" ON "public"."yacht_models"("builderId");

-- CreateIndex
CREATE INDEX "yacht_models_categoryId_idx" ON "public"."yacht_models"("categoryId");

-- AddForeignKey
ALTER TABLE "public"."yacht_models" ADD CONSTRAINT "yacht_models_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "public"."yacht_builders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."yacht_models" ADD CONSTRAINT "yacht_models_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."yacht_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
