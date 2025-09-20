-- CreateEnum
CREATE TYPE "public"."FilterScope" AS ENUM ('ORG', 'USER');

-- CreateEnum
CREATE TYPE "public"."LocationSource" AS ENUM ('NAUSYS', 'INTERNAL');

-- CreateTable
CREATE TABLE "public"."locations" (
    "id" TEXT NOT NULL,
    "source" "public"."LocationSource" NOT NULL DEFAULT 'NAUSYS',
    "externalId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "countryCode" CHAR(2),
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."location_aliases" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "location_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."competitor_filters" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "scope" "public"."FilterScope" NOT NULL DEFAULT 'ORG',
    "userId" TEXT,
    "lenFtMinus" INTEGER NOT NULL DEFAULT 3,
    "lenFtPlus" INTEGER NOT NULL DEFAULT 3,
    "yearMinus" INTEGER NOT NULL DEFAULT 2,
    "yearPlus" INTEGER NOT NULL DEFAULT 2,
    "peopleMinus" INTEGER NOT NULL DEFAULT 1,
    "peoplePlus" INTEGER NOT NULL DEFAULT 1,
    "cabinsMinus" INTEGER NOT NULL DEFAULT 1,
    "cabinsPlus" INTEGER NOT NULL DEFAULT 1,
    "headsMin" INTEGER NOT NULL DEFAULT 0,
    "pricePctRange" INTEGER NOT NULL DEFAULT 20,
    "minRating" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."countries" (
    "id" TEXT NOT NULL,
    "nausysId" INTEGER NOT NULL,
    "code2" CHAR(2) NOT NULL,
    "code3" CHAR(3),
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_FiltersLocations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FiltersLocations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "locations_source_idx" ON "public"."locations"("source");

-- CreateIndex
CREATE INDEX "locations_countryCode_idx" ON "public"."locations"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "locations_source_externalId_key" ON "public"."locations"("source", "externalId");

-- CreateIndex
CREATE INDEX "location_aliases_locationId_idx" ON "public"."location_aliases"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "location_aliases_normalized_key" ON "public"."location_aliases"("normalized");

-- CreateIndex
CREATE INDEX "competitor_filters_scope_idx" ON "public"."competitor_filters"("scope");

-- CreateIndex
CREATE INDEX "competitor_filters_orgId_idx" ON "public"."competitor_filters"("orgId");

-- CreateIndex
CREATE INDEX "competitor_filters_userId_idx" ON "public"."competitor_filters"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_filters_orgId_scope_userId_key" ON "public"."competitor_filters"("orgId", "scope", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "countries_nausysId_key" ON "public"."countries"("nausysId");

-- CreateIndex
CREATE UNIQUE INDEX "countries_code2_key" ON "public"."countries"("code2");

-- CreateIndex
CREATE INDEX "countries_name_idx" ON "public"."countries"("name");

-- CreateIndex
CREATE INDEX "_FiltersLocations_B_index" ON "public"."_FiltersLocations"("B");

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "public"."countries"("code2") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."location_aliases" ADD CONSTRAINT "location_aliases_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_filters" ADD CONSTRAINT "competitor_filters_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_filters" ADD CONSTRAINT "competitor_filters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_FiltersLocations" ADD CONSTRAINT "_FiltersLocations_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."competitor_filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_FiltersLocations" ADD CONSTRAINT "_FiltersLocations_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
