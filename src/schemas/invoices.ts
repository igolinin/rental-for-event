import { z } from "zod";

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.coerce.number().min(0.001, "Quantity must be positive"),
  unitAmount: z.coerce.number().int().min(0, "Unit amount must be ≥ 0"),
  taxRate: z.coerce.number().min(0).max(1).optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});

export type InvoiceLineItemFormValues = z.infer<typeof invoiceLineItemSchema>;

export const invoiceSchema = z.object({
  projectId: z.string().min(1, "Project required"),
  clientId: z.string().min(1, "Client required"),
  type: z.enum(["STANDARD", "DEPOSIT", "FINAL", "CREDIT_NOTE"]).default("STANDARD"),
  issueDate: z.string().min(1, "Issue date required"),
  dueDate: z.string().min(1, "Due date required"),
  currencyCode: z.string().min(1).max(3).default("USD"),
  taxRate: z.coerce.number().min(0).max(1).optional().nullable(),
  discountAmount: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  lineItems: z.array(invoiceLineItemSchema).min(1, "At least one line item is required"),
});

export type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export const invoiceUpdateSchema = invoiceSchema.omit({ projectId: true, clientId: true });
export type InvoiceUpdateFormValues = z.infer<typeof invoiceUpdateSchema>;

export const paymentSchema = z.object({
  amount: z.coerce.number().int().positive("Amount must be positive"),
  currency: z.string().min(1).max(3).default("USD"),
  method: z.enum(["BANK_TRANSFER", "CHECK", "CASH", "CARD", "OTHER"]).default("BANK_TRANSFER"),
  receivedAt: z.string().min(1, "Date required"),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;
