-- CreateEnum
CREATE TYPE "PhaseType" AS ENUM ('PACKING', 'LOAD_IN', 'SETUP', 'SHOW', 'STRIKE', 'LOAD_OUT', 'TRAVEL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "LaborSubcontractStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'RECEIVED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "CrewAssignment" ADD COLUMN     "phaseId" TEXT;

-- AlterTable
ALTER TABLE "SerializedUnit" ADD COLUMN     "warehouseId" TEXT;

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItemWarehouseStock" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryItemWarehouseStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPhase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" "PhaseType" NOT NULL,
    "customLabel" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborSubcontract" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "vendorName" TEXT NOT NULL,
    "vendorContact" TEXT,
    "vendorEmail" TEXT,
    "role" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "dailyRateAmount" INTEGER,
    "dailyRateCurrency" TEXT NOT NULL DEFAULT 'USD',
    "status" "LaborSubcontractStatus" NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaborSubcontract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Warehouse_isActive_idx" ON "Warehouse"("isActive");

-- CreateIndex
CREATE INDEX "InventoryItemWarehouseStock_inventoryItemId_idx" ON "InventoryItemWarehouseStock"("inventoryItemId");

-- CreateIndex
CREATE INDEX "InventoryItemWarehouseStock_warehouseId_idx" ON "InventoryItemWarehouseStock"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItemWarehouseStock_inventoryItemId_warehouseId_key" ON "InventoryItemWarehouseStock"("inventoryItemId", "warehouseId");

-- CreateIndex
CREATE INDEX "ProjectPhase_projectId_idx" ON "ProjectPhase"("projectId");

-- CreateIndex
CREATE INDEX "LaborSubcontract_projectId_idx" ON "LaborSubcontract"("projectId");

-- CreateIndex
CREATE INDEX "LaborSubcontract_phaseId_idx" ON "LaborSubcontract"("phaseId");

-- CreateIndex
CREATE INDEX "CrewAssignment_phaseId_idx" ON "CrewAssignment"("phaseId");

-- CreateIndex
CREATE INDEX "SerializedUnit_warehouseId_idx" ON "SerializedUnit"("warehouseId");

-- AddForeignKey
ALTER TABLE "InventoryItemWarehouseStock" ADD CONSTRAINT "InventoryItemWarehouseStock_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItemWarehouseStock" ADD CONSTRAINT "InventoryItemWarehouseStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerializedUnit" ADD CONSTRAINT "SerializedUnit_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhase" ADD CONSTRAINT "ProjectPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborSubcontract" ADD CONSTRAINT "LaborSubcontract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborSubcontract" ADD CONSTRAINT "LaborSubcontract_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewAssignment" ADD CONSTRAINT "CrewAssignment_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
