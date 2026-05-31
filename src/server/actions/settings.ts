"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
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
  const session = await auth();
  const denied = await requirePermission(session, "SETTINGS", "MANAGE");
  if (denied) return denied;

  const parsed = settingsSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const payload = {
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
  };

  const result = await safeDb(
    prisma.systemSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...payload },
      update: payload,
    })
  );

  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/settings");
  return { success: true };
}
