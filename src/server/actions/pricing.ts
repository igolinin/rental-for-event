"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { pricingProfileSchema } from "@/schemas/pricing";

export async function createPricingProfile(data: unknown) {
  const session = await auth();
  const denied = await requirePermission(session, "INVENTORY_PRICING", "MANAGE");
  if (denied) return denied;

  const parsed = pricingProfileSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const result = await safeDb(
    prisma.pricingProfile.create({
      data: {
        name: d.name,
        description: d.description || null,
        tiers: { create: d.tiers.map((t) => ({ minDays: t.minDays, multiplier: t.multiplier })) },
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "PricingProfile", entityId: result.value.id, entityLabel: d.name, action: "CREATE", userId: session?.user?.id });
  revalidatePath("/dashboard/pricing");
  return { success: true, id: result.value.id };
}

export async function updatePricingProfile(id: string, data: unknown) {
  const session = await auth();
  const denied = await requirePermission(session, "INVENTORY_PRICING", "MANAGE");
  if (denied) return denied;

  const parsed = pricingProfileSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const result = await safeDb(
    prisma.$transaction([
      prisma.pricingTier.deleteMany({ where: { profileId: id } }),
      prisma.pricingProfile.update({
        where: { id },
        data: {
          name: d.name,
          description: d.description || null,
          tiers: { create: d.tiers.map((t) => ({ minDays: t.minDays, multiplier: t.multiplier })) },
        },
      }),
    ])
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "PricingProfile", entityId: id, entityLabel: d.name, action: "UPDATE", userId: session?.user?.id });
  revalidatePath("/dashboard/pricing");
  return { success: true };
}

export async function deletePricingProfile(id: string) {
  const session = await auth();
  const denied = await requirePermission(session, "INVENTORY_PRICING", "MANAGE");
  if (denied) return denied;

  const profile = await prisma.pricingProfile.findUnique({
    where: { id },
    select: {
      name: true,
      isSystem: true,
      _count: { select: { inventoryItems: true, projectEquipment: true } },
    },
  });
  if (!profile) return { error: "Profile not found." };
  if (profile.isSystem) return { error: "The built-in profile cannot be deleted." };
  const usage = profile._count.inventoryItems + profile._count.projectEquipment;
  if (usage > 0) return { error: `Cannot delete: profile is in use by ${usage} item(s)/line(s).` };

  const result = await safeDb(prisma.pricingProfile.delete({ where: { id } }));
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "PricingProfile", entityId: id, entityLabel: profile.name, action: "DELETE", userId: session?.user?.id });
  revalidatePath("/dashboard/pricing");
  return { success: true };
}

export async function setDefaultProfile(id: string) {
  const session = await auth();
  const denied = await requirePermission(session, "INVENTORY_PRICING", "MANAGE");
  if (denied) return denied;

  const result = await safeDb(
    prisma.$transaction([
      prisma.pricingProfile.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      prisma.pricingProfile.update({ where: { id }, data: { isDefault: true } }),
    ])
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "PricingProfile", entityId: id, action: "UPDATE", userId: session?.user?.id, changes: { isDefault: { from: false, to: true } } });
  revalidatePath("/dashboard/pricing");
  return { success: true };
}

/** Create a new profile from a tweaked curve (used by the kit list "save as profile" flow). */
export async function saveLineAsProfile(data: unknown) {
  return createPricingProfile(data);
}
