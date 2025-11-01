-- AddForeignKey
ALTER TABLE "public"."CompetitorFilterPreset" ADD CONSTRAINT "CompetitorFilterPreset_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompetitorFilterPreset" ADD CONSTRAINT "CompetitorFilterPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
