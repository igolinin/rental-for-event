-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "TrackingMode" AS ENUM ('SERIALIZED', 'BULK');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('AVAILABLE', 'IN_SERVICE', 'IN_REPAIR', 'RETIRED');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('SINGLE_EVENT', 'MULTI_DAY_TOUR', 'LONG_TERM_RENTAL');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('INQUIRY', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('DAILY', 'WEEKLY', 'FLAT');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FUEL', 'ACCOMMODATION', 'CATERING', 'TRANSPORT', 'SUPPLIES', 'EQUIPMENT_REPAIR', 'OTHER');

-- CreateEnum
CREATE TYPE "SubRentalStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'RECEIVED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrewType" AS ENUM ('EMPLOYEE', 'FREELANCER');

-- CreateEnum
CREATE TYPE "CrewRateType" AS ENUM ('REGULAR', 'OVERTIME', 'DOUBLE_TIME', 'TRAVEL_DAY', 'PER_DIEM');

-- CreateEnum
CREATE TYPE "TimesheetType" AS ENUM ('WORK', 'TRAVEL', 'PER_DIEM');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REIMBURSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('SCHEDULED_SERVICE', 'REPAIR', 'INSPECTION', 'CLEANING', 'CALIBRATION');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('STANDARD', 'DEPOSIT', 'FINAL', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CHECK', 'CASH', 'CARD', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "refCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySubCategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventorySubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "refCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "subCategoryId" TEXT,
    "trackingMode" "TrackingMode" NOT NULL DEFAULT 'BULK',
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "dailyRateAmount" INTEGER,
    "dailyRateCurrency" TEXT NOT NULL DEFAULT 'USD',
    "replacementCostAmount" INTEGER,
    "replacementCostCurrency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerializedUnit" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "assetTag" TEXT,
    "status" "UnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "purchaseDate" TIMESTAMP(3),
    "purchasePriceAmount" INTEGER,
    "purchasePriceCurrency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerializedUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "refCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProjectType" NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'INQUIRY',
    "clientId" TEXT NOT NULL,
    "venue" TEXT,
    "city" TEXT,
    "country" TEXT,
    "loadInAt" TIMESTAMP(3),
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "loadOutAt" TIMESTAMP(3),
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "taxRate" DECIMAL(5,4),
    "depositAmount" INTEGER,
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEquipmentItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantityNeeded" INTEGER NOT NULL DEFAULT 1,
    "unitRateAmount" INTEGER,
    "unitRateCurrency" TEXT,
    "rateType" "RateType" NOT NULL DEFAULT 'DAILY',
    "rateDays" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectEquipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEquipmentAllocation" (
    "id" TEXT NOT NULL,
    "projectEquipmentItemId" TEXT NOT NULL,
    "serializedUnitId" TEXT NOT NULL,

    CONSTRAINT "ProjectEquipmentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectExpense" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "receiptUrl" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubRental" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorContact" TEXT,
    "vendorEmail" TEXT,
    "status" "SubRentalStatus" NOT NULL DEFAULT 'REQUESTED',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubRental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubRentalItem" (
    "id" TEXT NOT NULL,
    "subRentalId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitRateAmount" INTEGER NOT NULL,
    "unitRateCurrency" TEXT NOT NULL DEFAULT 'USD',
    "rateType" "RateType" NOT NULL DEFAULT 'DAILY',
    "rateDays" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SubRentalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewMember" (
    "id" TEXT NOT NULL,
    "refCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "type" "CrewType" NOT NULL DEFAULT 'FREELANCER',
    "role" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "taxId" TEXT,
    "emergencyContact" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrewMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewRate" (
    "id" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,
    "rateType" "CrewRateType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "CrewRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,
    "role" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrewAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "crewAssignmentId" TEXT,
    "crewMemberId" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "timeType" "TimesheetType" NOT NULL DEFAULT 'WORK',
    "regularHours" DECIMAL(6,2),
    "overtimeHours" DECIMAL(6,2),
    "doubleTimeHours" DECIMAL(6,2),
    "regularRateAmount" INTEGER,
    "overtimeRateAmount" INTEGER,
    "doubleTimeRateAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalAmount" INTEGER,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewExpense" (
    "id" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,
    "projectId" TEXT,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "receiptUrl" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrewExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceLog" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "serializedUnitId" TEXT,
    "type" "MaintenanceType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "vendor" TEXT,
    "technicianName" TEXT,
    "costAmount" INTEGER,
    "costCurrency" TEXT NOT NULL DEFAULT 'USD',
    "loggedById" TEXT NOT NULL,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "refCode" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "InvoiceType" NOT NULL DEFAULT 'STANDARD',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "subtotalAmount" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "taxRate" DECIMAL(5,4),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyConfig" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isBaseCurrency" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "exchangeRate" DECIMAL(12,6) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencyConfig_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "companyName" TEXT NOT NULL,
    "companyAddress" TEXT,
    "companyEmail" TEXT,
    "companyPhone" TEXT,
    "companyLogoUrl" TEXT,
    "defaultCurrencyCode" TEXT NOT NULL DEFAULT 'USD',
    "defaultTaxRate" DECIMAL(5,4),
    "invoiceTermsDays" INTEGER NOT NULL DEFAULT 30,
    "invoiceNotes" TEXT,
    "otDailyThreshold" INTEGER NOT NULL DEFAULT 8,
    "otWeeklyThreshold" INTEGER NOT NULL DEFAULT 40,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_refCode_key" ON "Client"("refCode");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_name_key" ON "InventoryCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_slug_key" ON "InventoryCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySubCategory_categoryId_slug_key" ON "InventorySubCategory"("categoryId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_refCode_key" ON "InventoryItem"("refCode");

-- CreateIndex
CREATE INDEX "InventoryItem_categoryId_idx" ON "InventoryItem"("categoryId");

-- CreateIndex
CREATE INDEX "InventoryItem_trackingMode_idx" ON "InventoryItem"("trackingMode");

-- CreateIndex
CREATE INDEX "InventoryItem_isActive_idx" ON "InventoryItem"("isActive");

-- CreateIndex
CREATE INDEX "SerializedUnit_status_idx" ON "SerializedUnit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SerializedUnit_inventoryItemId_serialNumber_key" ON "SerializedUnit"("inventoryItemId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Project_refCode_key" ON "Project"("refCode");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_startAt_endAt_idx" ON "Project"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "ProjectEquipmentItem_projectId_idx" ON "ProjectEquipmentItem"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectEquipmentAllocation_projectEquipmentItemId_serialize_key" ON "ProjectEquipmentAllocation"("projectEquipmentItemId", "serializedUnitId");

-- CreateIndex
CREATE INDEX "ProjectExpense_projectId_idx" ON "ProjectExpense"("projectId");

-- CreateIndex
CREATE INDEX "SubRental_projectId_idx" ON "SubRental"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CrewMember_refCode_key" ON "CrewMember"("refCode");

-- CreateIndex
CREATE UNIQUE INDEX "CrewMember_email_key" ON "CrewMember"("email");

-- CreateIndex
CREATE INDEX "CrewRate_crewMemberId_idx" ON "CrewRate"("crewMemberId");

-- CreateIndex
CREATE INDEX "CrewAssignment_projectId_idx" ON "CrewAssignment"("projectId");

-- CreateIndex
CREATE INDEX "CrewAssignment_crewMemberId_idx" ON "CrewAssignment"("crewMemberId");

-- CreateIndex
CREATE INDEX "Timesheet_projectId_idx" ON "Timesheet"("projectId");

-- CreateIndex
CREATE INDEX "Timesheet_crewMemberId_idx" ON "Timesheet"("crewMemberId");

-- CreateIndex
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");

-- CreateIndex
CREATE INDEX "CrewExpense_crewMemberId_idx" ON "CrewExpense"("crewMemberId");

-- CreateIndex
CREATE INDEX "CrewExpense_status_idx" ON "CrewExpense"("status");

-- CreateIndex
CREATE INDEX "MaintenanceLog_inventoryItemId_idx" ON "MaintenanceLog"("inventoryItemId");

-- CreateIndex
CREATE INDEX "MaintenanceLog_status_idx" ON "MaintenanceLog"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_refCode_key" ON "Invoice"("refCode");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE INDEX "Invoice_projectId_idx" ON "Invoice"("projectId");

-- AddForeignKey
ALTER TABLE "InventorySubCategory" ADD CONSTRAINT "InventorySubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "InventorySubCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerializedUnit" ADD CONSTRAINT "SerializedUnit_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEquipmentItem" ADD CONSTRAINT "ProjectEquipmentItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEquipmentItem" ADD CONSTRAINT "ProjectEquipmentItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEquipmentAllocation" ADD CONSTRAINT "ProjectEquipmentAllocation_projectEquipmentItemId_fkey" FOREIGN KEY ("projectEquipmentItemId") REFERENCES "ProjectEquipmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEquipmentAllocation" ADD CONSTRAINT "ProjectEquipmentAllocation_serializedUnitId_fkey" FOREIGN KEY ("serializedUnitId") REFERENCES "SerializedUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExpense" ADD CONSTRAINT "ProjectExpense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubRental" ADD CONSTRAINT "SubRental_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubRentalItem" ADD CONSTRAINT "SubRentalItem_subRentalId_fkey" FOREIGN KEY ("subRentalId") REFERENCES "SubRental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubRentalItem" ADD CONSTRAINT "SubRentalItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewRate" ADD CONSTRAINT "CrewRate_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewAssignment" ADD CONSTRAINT "CrewAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewAssignment" ADD CONSTRAINT "CrewAssignment_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_crewAssignmentId_fkey" FOREIGN KEY ("crewAssignmentId") REFERENCES "CrewAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewExpense" ADD CONSTRAINT "CrewExpense_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_serializedUnitId_fkey" FOREIGN KEY ("serializedUnitId") REFERENCES "SerializedUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
