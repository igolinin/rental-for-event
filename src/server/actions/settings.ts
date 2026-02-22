"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const settingsSchema = z.object({
  companyName: z.string().min(1, "Company name required"),
  companyAddress: z.string().optional().nullable(),
  companyEmail: z.string().email().optional().nullable().or(z.literal("")),
  companyPhone: z.string().optional().nullable(),
  defaultCurrencyCode: z.string().length(3).default("USD"),
  defaultTaxRate: z.coerce.number().min(0).max(1).optional().nullable(),
  invoiceTermsDays: z.coerce.number().int().min(0).default(30),
  invoiceNotes: z.string().optional().nullable(),
  otDailyThreshold: z.coerce.number().int().min(1).default(8),
  otWeeklyThreshold: z.coerce.number().int().min(1).default(40),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

export async function upsertSettings(data: unknown) {
  const parsed = settingsSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  await prisma.systemSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      companyName: d.companyName,
      companyAddress: d.companyAddress || null,
      companyEmail: d.companyEmail || null,
      companyPhone: d.companyPhone || null,
      defaultCurrencyCode: d.defaultCurrencyCode,
      defaultTaxRate: d.defaultTaxRate ?? null,
      invoiceTermsDays: d.invoiceTermsDays,
      invoiceNotes: d.invoiceNotes || null,
      otDailyThreshold: d.otDailyThreshold,
      otWeeklyThreshold: d.otWeeklyThreshold,
    },
    update: {
      companyName: d.companyName,
      companyAddress: d.companyAddress || null,
      companyEmail: d.companyEmail || null,
      companyPhone: d.companyPhone || null,
      defaultCurrencyCode: d.defaultCurrencyCode,
      defaultTaxRate: d.defaultTaxRate ?? null,
      invoiceTermsDays: d.invoiceTermsDays,
      invoiceNotes: d.invoiceNotes || null,
      otDailyThreshold: d.otDailyThreshold,
      otWeeklyThreshold: d.otWeeklyThreshold,
    },
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}
