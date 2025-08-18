-- CreateEnum
CREATE TYPE "WeekSlotStatus" AS ENUM ('BOOKED', 'OPEN', 'OPTION');

-- CreateTable
CREATE TABLE "Yacht" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "length" DOUBLE PRECISION NOT NULL,
    "builtYear" INTEGER NOT NULL,
    "cabins" INTEGER NOT NULL,
    "heads" INTEGER NOT NULL,
    "basePrice" DECIMAL(65,30) NOT NULL,
    "location" TEXT NOT NULL,
    "fleet" TEXT NOT NULL,
    "charterCompany" TEXT NOT NULL,
    "currentExtraServices" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Yacht_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekSlot" (
    "id" TEXT NOT NULL,
    "yachtId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" "WeekSlotStatus" NOT NULL,
    "currentPrice" DECIMAL(65,30) NOT NULL,
    "currentDiscount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "weekSlotId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" DECIMAL(65,30) NOT NULL,
    "discount" DECIMAL(65,30) NOT NULL,
    "authorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraServiceHistory" (
    "id" TEXT NOT NULL,
    "yachtId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serviceName" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtraServiceHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WeekSlot" ADD CONSTRAINT "WeekSlot_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "Yacht"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_weekSlotId_fkey" FOREIGN KEY ("weekSlotId") REFERENCES "WeekSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraServiceHistory" ADD CONSTRAINT "ExtraServiceHistory_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "Yacht"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
