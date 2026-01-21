-- CreateTable
CREATE TABLE "public"."price_list_nodes" (
    "id" TEXT NOT NULL,
    "yachtId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "source" "public"."PriceSource" DEFAULT 'INTERNAL',
    "importedAt" TIMESTAMP(3),
    "note" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_list_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_list_nodes_yachtId_weekStart_idx" ON "public"."price_list_nodes"("yachtId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_nodes_yachtId_weekStart_key" ON "public"."price_list_nodes"("yachtId", "weekStart");

-- AddForeignKey
ALTER TABLE "public"."price_list_nodes" ADD CONSTRAINT "price_list_nodes_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_list_nodes" ADD CONSTRAINT "price_list_nodes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
