-- DropForeignKey
ALTER TABLE "public"."competitor_prices" DROP CONSTRAINT "competitor_prices_yachtId_fkey";

-- DropForeignKey
ALTER TABLE "public"."competitor_snapshots" DROP CONSTRAINT "competitor_snapshots_yachtId_fkey";

-- DropForeignKey
ALTER TABLE "public"."extra_service_history" DROP CONSTRAINT "extra_service_history_yachtId_fkey";

-- DropForeignKey
ALTER TABLE "public"."manager_yachts" DROP CONSTRAINT "manager_yachts_yachtId_fkey";

-- DropForeignKey
ALTER TABLE "public"."owner_yachts" DROP CONSTRAINT "owner_yachts_yachtId_fkey";

-- DropForeignKey
ALTER TABLE "public"."price_audit_logs" DROP CONSTRAINT "price_audit_logs_decisionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."price_history" DROP CONSTRAINT "price_history_weekSlotId_fkey";

-- DropForeignKey
ALTER TABLE "public"."pricing_decisions" DROP CONSTRAINT "pricing_decisions_yachtId_fkey";

-- DropForeignKey
ALTER TABLE "public"."week_slots" DROP CONSTRAINT "week_slots_yachtId_fkey";

-- AddForeignKey
ALTER TABLE "public"."week_slots" ADD CONSTRAINT "week_slots_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_history" ADD CONSTRAINT "price_history_weekSlotId_fkey" FOREIGN KEY ("weekSlotId") REFERENCES "public"."week_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."extra_service_history" ADD CONSTRAINT "extra_service_history_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_prices" ADD CONSTRAINT "competitor_prices_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_snapshots" ADD CONSTRAINT "competitor_snapshots_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pricing_decisions" ADD CONSTRAINT "pricing_decisions_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."manager_yachts" ADD CONSTRAINT "manager_yachts_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."owner_yachts" ADD CONSTRAINT "owner_yachts_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_audit_logs" ADD CONSTRAINT "price_audit_logs_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "public"."pricing_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
