-- AlterTable
ALTER TABLE "InventoryCategory" ADD COLUMN     "defaultNoDiscount" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "noDiscount" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "discountFixed" INTEGER,
ADD COLUMN     "discountPercent" DECIMAL(5,4);

-- AlterTable
ALTER TABLE "ProjectEquipmentItem" ADD COLUMN     "discountFixed" INTEGER,
ADD COLUMN     "discountPercent" DECIMAL(5,4);

-- CreateTable
CREATE TABLE "ProjectCategoryDiscount" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "discountPercent" DECIMAL(5,4),
    "discountFixed" INTEGER,

    CONSTRAINT "ProjectCategoryDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectCategoryDiscount_projectId_idx" ON "ProjectCategoryDiscount"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCategoryDiscount_projectId_categoryId_key" ON "ProjectCategoryDiscount"("projectId", "categoryId");

-- AddForeignKey
ALTER TABLE "ProjectCategoryDiscount" ADD CONSTRAINT "ProjectCategoryDiscount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCategoryDiscount" ADD CONSTRAINT "ProjectCategoryDiscount_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
