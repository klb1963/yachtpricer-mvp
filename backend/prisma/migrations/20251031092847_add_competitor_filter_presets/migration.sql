-- CreateTable
CREATE TABLE "public"."CompetitorFilterPreset" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "scope" "public"."FilterScope" NOT NULL,
    "name" TEXT NOT NULL,
    "countryIds" TEXT[],
    "regionIds" INTEGER[],
    "locationIds" TEXT[],
    "categoryIds" INTEGER[],
    "builderIds" INTEGER[],
    "modelIds" INTEGER[],
    "lenFtMinus" INTEGER NOT NULL,
    "lenFtPlus" INTEGER NOT NULL,
    "yearMinus" INTEGER NOT NULL,
    "yearPlus" INTEGER NOT NULL,
    "peopleMinus" INTEGER NOT NULL,
    "peoplePlus" INTEGER NOT NULL,
    "cabinsMinus" INTEGER NOT NULL,
    "cabinsPlus" INTEGER NOT NULL,
    "headsMin" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorFilterPreset_pkey" PRIMARY KEY ("id")
);
