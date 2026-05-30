import { z } from "zod";

export const warehouseSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type WarehouseFormValues = z.infer<typeof warehouseSchema>;

export const warehouseStockSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  quantity: z.coerce.number().int().min(0, "Quantity must be 0 or more"),
});

export type WarehouseStockFormValues = z.infer<typeof warehouseStockSchema>;
