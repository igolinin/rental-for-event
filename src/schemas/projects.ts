import { z } from "zod";

export const projectSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  type: z.enum(["SINGLE_EVENT", "MULTI_DAY_TOUR", "LONG_TERM_RENTAL"]),
  status: z.enum(["INQUIRY", "QUOTED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("INQUIRY"),
  clientId: z.string().min(1, "Client is required"),
  venue: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  loadInAt: z.string().optional().nullable(),
  startAt: z.string().min(1, "Start date is required"),
  endAt: z.string().min(1, "End date is required"),
  loadOutAt: z.string().optional().nullable(),
  currencyCode: z.string().length(3).default("USD"),
  taxRate: z.coerce.number().min(0).max(1).optional().nullable(),
  depositAmount: z.coerce.number().int().min(0).optional().nullable(),
  discountPercent: z.coerce.number().min(0).max(1).optional().nullable(),
  discountFixed: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  internalNotes: z.string().max(2000).optional().nullable(),
}).refine((d) => new Date(d.endAt) >= new Date(d.startAt), {
  message: "End date must be on or after start date",
  path: ["endAt"],
}).refine((d) => !d.loadInAt || new Date(d.startAt) >= new Date(d.loadInAt), {
  message: "Start date must be on or after load-in date",
  path: ["startAt"],
}).refine((d) => !d.loadOutAt || new Date(d.loadOutAt) >= new Date(d.endAt), {
  message: "Load-out date must be on or after end date",
  path: ["loadOutAt"],
}).refine((d) => !(d.discountPercent && d.discountFixed), {
  message: "Set either a percentage or a fixed discount, not both",
  path: ["discountFixed"],
});

export type ProjectFormValues = z.infer<typeof projectSchema>;

export const equipmentItemSchema = z.object({
  inventoryItemId: z.string().min(1, "Item is required"),
  quantityNeeded: z.coerce.number().int().min(1, "Must be at least 1"),
  unitRateAmount: z.coerce.number().int().min(0).optional().nullable(),
  unitRateCurrency: z.string().length(3).default("USD"),
  rateType: z.enum(["DAILY", "WEEKLY", "FLAT"]).default("DAILY"),
  rateDays: z.coerce.number().int().min(1).default(1),
  pricingProfileId: z.string().optional().nullable(),
  discountPercent: z.coerce.number().min(0).max(1).optional().nullable(),
  discountFixed: z.coerce.number().int().min(0).optional().nullable(),
  description: z.string().max(200).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
}).refine((d) => !(d.discountPercent && d.discountFixed), {
  message: "Set either a percentage or a fixed discount, not both",
  path: ["discountFixed"],
});

export type EquipmentItemFormValues = z.infer<typeof equipmentItemSchema>;

export const categoryDiscountSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  discountPercent: z.coerce.number().min(0).max(1).optional().nullable(),
  discountFixed: z.coerce.number().int().min(0).optional().nullable(),
}).refine((d) => !(d.discountPercent && d.discountFixed), {
  message: "Set either a percentage or a fixed discount, not both",
  path: ["discountFixed"],
});

export type CategoryDiscountFormValues = z.infer<typeof categoryDiscountSchema>;

export const projectExpenseSchema = z.object({
  description: z.string().min(1, "Description is required").max(200),
  category: z.enum(["FUEL", "ACCOMMODATION", "CATERING", "TRANSPORT", "SUPPLIES", "EQUIPMENT_REPAIR", "OTHER"]),
  amount: z.coerce.number().int().min(0, "Amount must be non-negative"),
  currency: z.string().length(3).default("USD"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().max(500).optional().nullable(),
});

export type ProjectExpenseFormValues = z.infer<typeof projectExpenseSchema>;

export const subRentalSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required").max(200),
  vendorContact: z.string().max(200).optional().nullable(),
  vendorEmail: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  startAt: z.string().min(1, "Start date is required"),
  endAt: z.string().min(1, "End date is required"),
  notes: z.string().max(500).optional().nullable(),
});

export type SubRentalFormValues = z.infer<typeof subRentalSchema>;

export const subRentalItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(200),
  quantity: z.coerce.number().int().min(1),
  unitRateAmount: z.coerce.number().int().min(0),
  unitRateCurrency: z.string().length(3).default("USD"),
  rateType: z.enum(["DAILY", "WEEKLY", "FLAT"]).default("DAILY"),
  rateDays: z.coerce.number().int().min(1).default(1),
});

export type SubRentalItemFormValues = z.infer<typeof subRentalItemSchema>;
