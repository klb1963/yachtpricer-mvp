-- CreateIndex
CREATE INDEX "CompetitorSnapshot_yachtId_weekStart_idx" ON "public"."CompetitorSnapshot"("yachtId", "weekStart");

-- AddForeignKey
ALTER TABLE "public"."CompetitorSnapshot" ADD CONSTRAINT "CompetitorSnapshot_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."Yacht"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
