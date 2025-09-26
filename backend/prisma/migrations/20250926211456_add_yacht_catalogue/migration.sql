-- CreateTable
CREATE TABLE "public"."YachtCategory" (
    "id" SERIAL NOT NULL,
    "nausysId" INTEGER NOT NULL,
    "names" JSONB NOT NULL,
    "name_en" TEXT,
    "name_de" TEXT,
    "name_ru" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YachtCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."YachtBuilder" (
    "id" SERIAL NOT NULL,
    "nausysId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YachtBuilder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."YachtModel" (
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

    CONSTRAINT "YachtModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YachtCategory_nausysId_key" ON "public"."YachtCategory"("nausysId");

-- CreateIndex
CREATE UNIQUE INDEX "YachtBuilder_nausysId_key" ON "public"."YachtBuilder"("nausysId");

-- CreateIndex
CREATE INDEX "YachtBuilder_name_idx" ON "public"."YachtBuilder"("name");

-- CreateIndex
CREATE UNIQUE INDEX "YachtModel_nausysId_key" ON "public"."YachtModel"("nausysId");

-- CreateIndex
CREATE INDEX "YachtModel_name_idx" ON "public"."YachtModel"("name");

-- CreateIndex
CREATE INDEX "YachtModel_builderId_idx" ON "public"."YachtModel"("builderId");

-- CreateIndex
CREATE INDEX "YachtModel_categoryId_idx" ON "public"."YachtModel"("categoryId");

-- AddForeignKey
ALTER TABLE "public"."YachtModel" ADD CONSTRAINT "YachtModel_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "public"."YachtBuilder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."YachtModel" ADD CONSTRAINT "YachtModel_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."YachtCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
