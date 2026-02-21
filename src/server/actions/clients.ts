"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateShortCode } from "@/lib/utils";
import { clientSchema } from "@/schemas/clients";

export async function createClient(data: unknown) {
  const parsed = clientSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const refCode = generateShortCode("CLI");

  const client = await prisma.client.create({
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
  });

  revalidatePath("/dashboard/clients");
  return { success: true, id: client.id };
}

export async function updateClient(id: string, data: unknown) {
  const parsed = clientSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  await prisma.client.update({
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
  });

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${id}`);
  return { success: true };
}
