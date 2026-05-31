"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { generateShortCode } from "@/lib/utils";
import { clientSchema } from "@/schemas/clients";

export async function createClient(data: unknown) {
  const session = await auth();
  const denied = await requirePermission(session, "CLIENTS", "CREATE");
  if (denied) return denied;

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
  await logAudit({ entityType: "Client", entityId: result.value.id, entityLabel: d.name, action: "CREATE", userId: session!.user.id });
  revalidatePath("/dashboard/clients");
  return { success: true, id: result.value.id };
}

export async function updateClient(id: string, data: unknown) {
  const session = await auth();
  const denied = await requirePermission(session, "CLIENTS", "UPDATE");
  if (denied) return denied;

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
  const session = await auth();
  const denied = await requirePermission(session, "CLIENTS", "DELETE");
  if (denied) return denied;
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
