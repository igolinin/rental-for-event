"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeDb } from "@/lib/db";
import { generateShortCode } from "@/lib/utils";
import { clientSchema } from "@/schemas/clients";

export async function createClient(data: unknown) {
  const parsed = clientSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const refCode = generateShortCode("CLI");

  const result = await safeDb(
    prisma.client.create({
      data: {
        refCode,
        name: d.name,
        contactName: d.contactName,
        email: d.email || null,
        phone: d.phone,
        address: d.address,
        city: d.city,
        country: d.country,
        taxId: d.taxId,
        notes: d.notes,
        isActive: d.isActive,
      },
    })
  );

  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/clients");
  return { success: true, id: result.value.id };
}

export async function updateClient(id: string, data: unknown) {
  const parsed = clientSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const result = await safeDb(
    prisma.client.update({
      where: { id },
      data: {
        name: d.name,
        contactName: d.contactName,
        email: d.email || null,
        phone: d.phone,
        address: d.address,
        city: d.city,
        country: d.country,
        taxId: d.taxId,
        notes: d.notes,
        isActive: d.isActive,
      },
    })
  );

  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${id}`);
  return { success: true };
}

export async function deleteClient(id: string) {
  const countResult = await safeDb(
    prisma.project.count({
      where: { clientId: id, status: { notIn: ["CANCELLED", "COMPLETED"] } },
    })
  );
  if (countResult.isErr()) return { error: countResult.error };

  if (countResult.value > 0) {
    return {
      error: `Cannot delete: client has ${countResult.value} active project(s). Cancel or complete them first.`,
    };
  }

  const result = await safeDb(prisma.client.delete({ where: { id } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/clients");
  return { success: true };
}
