-- CreateTable
CREATE TABLE "public"."regions" (
    "id" SERIAL NOT NULL,
    "nausysId" INTEGER NOT NULL,
    "names" JSONB NOT NULL,
    "name_en" TEXT,
    "name_de" TEXT,
    "name_ru" TEXT,
    "countryNausysId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regions_nausysId_key" ON "public"."regions"("nausysId");

-- CreateIndex
CREATE INDEX "regions_countryNausysId_idx" ON "public"."regions"("countryNausysId");

-- AddForeignKey
ALTER TABLE "public"."regions" ADD CONSTRAINT "regions_countryNausysId_fkey" FOREIGN KEY ("countryNausysId") REFERENCES "public"."countries"("nausysId") ON DELETE SET NULL ON UPDATE CASCADE;
