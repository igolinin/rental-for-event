import { z } from "zod";

// ─── Categories ─────────────────────────────────────────────────────────────

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex colour e.g. #3B82F6").optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});

export const subCategorySchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  name: z.string().min(1, "Name is required").max(100),
});

// ─── Inventory Items ─────────────────────────────────────────────────────────

export const inventoryItemSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional().nullable(),
  categoryId: z.string().min(1, "Category is required"),
  subCategoryId: z.string().optional().nullable(),
  trackingMode: z.enum(["SERIALIZED", "BULK"]),
  totalQuantity: z.coerce.number().int().min(0).default(0),
  // Refined below: BULK items require totalQuantity > 0
  dailyRateAmount: z.coerce.number().int().min(0).optional().nullable(),
  dailyRateCurrency: z.string().length(3).default("USD"),
  replacementCostAmount: z.coerce.number().int().min(0).optional().nullable(),
  replacementCostCurrency: z.string().length(3).default("USD"),
  notes: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const inventoryItemSchemaRefined = inventoryItemSchema.refine(
  (d) => d.trackingMode !== "BULK" || d.totalQuantity > 0,
  { message: "Bulk items require a quantity greater than zero", path: ["totalQuantity"] }
);

export type InventoryItemFormValues = z.infer<typeof inventoryItemSchema>;

// ─── Serialized Units ────────────────────────────────────────────────────────

export const serializedUnitSchema = z.object({
  serialNumber: z.string().min(1, "Serial number is required").max(100),
  assetTag: z.string().max(100).optional().nullable(),
  status: z.enum(["AVAILABLE", "IN_SERVICE", "IN_REPAIR", "RETIRED"]).default("AVAILABLE"),
  purchaseDate: z.string().optional().nullable(),
  purchasePriceAmount: z.coerce.number().int().min(0).optional().nullable(),
  purchasePriceCurrency: z.string().length(3).default("USD"),
  notes: z.string().max(500).optional().nullable(),
});

export type SerializedUnitFormValues = z.infer<typeof serializedUnitSchema>;

// ─── Maintenance Logs ────────────────────────────────────────────────────────

export const maintenanceLogSchema = z.object({
  inventoryItemId: z.string().min(1, "Item is required"),
  serializedUnitId: z.string().optional().nullable(),
  type: z.enum(["SCHEDULED_SERVICE", "REPAIR", "INSPECTION", "CLEANING", "CALIBRATION"]),
  description: z.string().min(1, "Description is required").max(1000),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("OPEN"),
  reportedAt: z.string().optional().nullable(),
  startedAt: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable(),
  vendor: z.string().max(200).optional().nullable(),
  technicianName: z.string().max(200).optional().nullable(),
  costAmount: z.coerce.number().int().min(0).optional().nullable(),
  costCurrency: z.string().length(3).default("USD"),
  notes: z.string().max(1000).optional().nullable(),
});

export type MaintenanceLogFormValues = z.infer<typeof maintenanceLogSchema>;
