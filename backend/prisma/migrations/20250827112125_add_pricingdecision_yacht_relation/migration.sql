-- AddForeignKey
ALTER TABLE "public"."PricingDecision" ADD CONSTRAINT "PricingDecision_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."Yacht"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
