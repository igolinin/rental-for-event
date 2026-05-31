-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "pricingProfileId" TEXT;

-- AlterTable
ALTER TABLE "ProjectEquipmentItem" ADD COLUMN     "pricingProfileId" TEXT;

-- CreateTable
CREATE TABLE "PricingProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingTier" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "minDays" INTEGER NOT NULL,
    "multiplier" DECIMAL(8,3) NOT NULL,

    CONSTRAINT "PricingTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingProfile_name_key" ON "PricingProfile"("name");

-- CreateIndex
CREATE INDEX "PricingTier_profileId_idx" ON "PricingTier"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingTier_profileId_minDays_key" ON "PricingTier"("profileId", "minDays");

-- CreateIndex
CREATE INDEX "InventoryItem_pricingProfileId_idx" ON "InventoryItem"("pricingProfileId");

-- CreateIndex
CREATE INDEX "ProjectEquipmentItem_pricingProfileId_idx" ON "ProjectEquipmentItem"("pricingProfileId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_pricingProfileId_fkey" FOREIGN KEY ("pricingProfileId") REFERENCES "PricingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingTier" ADD CONSTRAINT "PricingTier_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PricingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEquipmentItem" ADD CONSTRAINT "ProjectEquipmentItem_pricingProfileId_fkey" FOREIGN KEY ("pricingProfileId") REFERENCES "PricingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
