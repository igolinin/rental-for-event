-- CreateEnum
CREATE TYPE "PropertyValueType" AS ENUM ('TEXT', 'NUMERIC', 'BOOLEAN');

-- CreateTable
CREATE TABLE "InventoryItemImage" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItemImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryPropertyDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "valueType" "PropertyValueType" NOT NULL,
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryPropertyDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItemProperty" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "propertyDefId" TEXT NOT NULL,
    "textValue" TEXT,
    "numericValue" DECIMAL(15,4),
    "booleanValue" BOOLEAN,

    CONSTRAINT "InventoryItemProperty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryItemImage_inventoryItemId_idx" ON "InventoryItemImage"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPropertyDef_name_key" ON "InventoryPropertyDef"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPropertyDef_slug_key" ON "InventoryPropertyDef"("slug");

-- CreateIndex
CREATE INDEX "InventoryPropertyDef_valueType_idx" ON "InventoryPropertyDef"("valueType");

-- CreateIndex
CREATE INDEX "InventoryItemProperty_inventoryItemId_idx" ON "InventoryItemProperty"("inventoryItemId");

-- CreateIndex
CREATE INDEX "InventoryItemProperty_propertyDefId_idx" ON "InventoryItemProperty"("propertyDefId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItemProperty_inventoryItemId_propertyDefId_key" ON "InventoryItemProperty"("inventoryItemId", "propertyDefId");

-- AddForeignKey
ALTER TABLE "InventoryItemImage" ADD CONSTRAINT "InventoryItemImage_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItemProperty" ADD CONSTRAINT "InventoryItemProperty_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItemProperty" ADD CONSTRAINT "InventoryItemProperty_propertyDefId_fkey" FOREIGN KEY ("propertyDefId") REFERENCES "InventoryPropertyDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;
