-- CreateTable
CREATE TABLE "public"."_FiltersCategories" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_FiltersCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_FiltersBuilders" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_FiltersBuilders_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_FiltersModels" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_FiltersModels_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_FiltersCategories_B_index" ON "public"."_FiltersCategories"("B");

-- CreateIndex
CREATE INDEX "_FiltersBuilders_B_index" ON "public"."_FiltersBuilders"("B");

-- CreateIndex
CREATE INDEX "_FiltersModels_B_index" ON "public"."_FiltersModels"("B");

-- AddForeignKey
ALTER TABLE "public"."_FiltersCategories" ADD CONSTRAINT "_FiltersCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."competitor_filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_FiltersCategories" ADD CONSTRAINT "_FiltersCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."yacht_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_FiltersBuilders" ADD CONSTRAINT "_FiltersBuilders_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."competitor_filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_FiltersBuilders" ADD CONSTRAINT "_FiltersBuilders_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."yacht_builders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_FiltersModels" ADD CONSTRAINT "_FiltersModels_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."competitor_filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_FiltersModels" ADD CONSTRAINT "_FiltersModels_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."yacht_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
