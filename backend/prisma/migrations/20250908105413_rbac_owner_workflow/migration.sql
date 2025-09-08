-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'FLEET_MANAGER', 'MANAGER', 'OWNER');

-- CreateEnum
CREATE TYPE "public"."OwnerMode" AS ENUM ('ACTIVE', 'VIEW_ONLY', 'HIDDEN');

-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('SUBMIT', 'APPROVE', 'REJECT');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "public"."Role" NOT NULL,
    "orgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."manager_yachts" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "yachtId" TEXT NOT NULL,

    CONSTRAINT "manager_yachts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."owner_yachts" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "yachtId" TEXT NOT NULL,
    "orgId" TEXT,
    "mode" "public"."OwnerMode" NOT NULL DEFAULT 'VIEW_ONLY',
    "allowEdit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "owner_yachts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."price_audit_logs" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "action" "public"."AuditAction" NOT NULL,
    "fromStatus" "public"."DecisionStatus",
    "toStatus" "public"."DecisionStatus" NOT NULL,
    "actorId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "manager_yachts_yachtId_idx" ON "public"."manager_yachts"("yachtId");

-- CreateIndex
CREATE UNIQUE INDEX "manager_yachts_managerId_yachtId_key" ON "public"."manager_yachts"("managerId", "yachtId");

-- CreateIndex
CREATE INDEX "owner_yachts_yachtId_idx" ON "public"."owner_yachts"("yachtId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_yachts_ownerId_yachtId_key" ON "public"."owner_yachts"("ownerId", "yachtId");

-- CreateIndex
CREATE INDEX "price_audit_logs_decisionId_idx" ON "public"."price_audit_logs"("decisionId");

-- CreateIndex
CREATE INDEX "price_audit_logs_actorId_idx" ON "public"."price_audit_logs"("actorId");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."manager_yachts" ADD CONSTRAINT "manager_yachts_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."manager_yachts" ADD CONSTRAINT "manager_yachts_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."owner_yachts" ADD CONSTRAINT "owner_yachts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."owner_yachts" ADD CONSTRAINT "owner_yachts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."owner_yachts" ADD CONSTRAINT "owner_yachts_yachtId_fkey" FOREIGN KEY ("yachtId") REFERENCES "public"."yachts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_audit_logs" ADD CONSTRAINT "price_audit_logs_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "public"."pricing_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_audit_logs" ADD CONSTRAINT "price_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
