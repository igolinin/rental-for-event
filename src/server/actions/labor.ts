"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeDb } from "@/lib/db";
import { laborSubcontractSchema } from "@/schemas/labor";

export async function createLaborSubcontract(projectId: string, data: unknown) {
  const parsed = laborSubcontractSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const result = await safeDb(
    prisma.laborSubcontract.create({
      data: {
        projectId,
        phaseId: d.phaseId || null,
        vendorName: d.vendorName,
        vendorContact: d.vendorContact || null,
        vendorEmail: d.vendorEmail || null,
        role: d.role || null,
        quantity: d.quantity,
        startAt: new Date(d.startAt),
        endAt: new Date(d.endAt),
        dailyRateAmount: d.dailyRateAmount ?? null,
        dailyRateCurrency: d.dailyRateCurrency,
        status: d.status,
        notes: d.notes || null,
      },
    })
  );

  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true, id: result.value.id };
}

export async function updateLaborSubcontractStatus(
  id: string,
  projectId: string,
  status: "REQUESTED" | "CONFIRMED" | "RECEIVED" | "COMPLETED" | "CANCELLED"
) {
  const result = await safeDb(
    prisma.laborSubcontract.update({ where: { id }, data: { status } })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function deleteLaborSubcontract(id: string, projectId: string) {
  const result = await safeDb(
    prisma.laborSubcontract.delete({ where: { id } })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}
