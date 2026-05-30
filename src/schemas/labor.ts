import { z } from "zod";

export const LABOR_STATUSES = [
  "REQUESTED",
  "CONFIRMED",
  "RECEIVED",
  "COMPLETED",
  "CANCELLED",
] as const;

export const laborSubcontractSchema = z.object({
  phaseId: z.string().optional().nullable(),
  vendorName: z.string().min(1, "Vendor name is required").max(200),
  vendorContact: z.string().max(200).optional().nullable(),
  vendorEmail: z
    .string()
    .email("Invalid email")
    .optional()
    .nullable()
    .or(z.literal("")),
  role: z.string().max(100).optional().nullable(),
  quantity: z.coerce.number().int().min(1, "At least 1 person required").default(1),
  startAt: z.string().min(1, "Start date is required"),
  endAt: z.string().min(1, "End date is required"),
  dailyRateAmount: z.coerce.number().int().min(0).optional().nullable(),
  dailyRateCurrency: z.string().length(3).default("USD"),
  status: z.enum(LABOR_STATUSES).default("REQUESTED"),
  notes: z.string().max(500).optional().nullable(),
}).refine((d) => new Date(d.endAt) >= new Date(d.startAt), {
  message: "End date must be on or after start date",
  path: ["endAt"],
});

export type LaborSubcontractFormValues = z.infer<typeof laborSubcontractSchema>;
