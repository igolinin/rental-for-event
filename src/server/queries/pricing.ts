import { prisma } from "@/lib/prisma";
import type { PricingTierLite } from "@/lib/pricing";

export async function getPricingProfiles() {
  return prisma.pricingProfile.findMany({
    include: {
      tiers: { orderBy: { minDays: "asc" } },
      _count: { select: { inventoryItems: true, projectEquipment: true } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export type PricingProfileEntry = Awaited<ReturnType<typeof getPricingProfiles>>[number];

export async function getDefaultProfile() {
  return prisma.pricingProfile.findFirst({
    where: { isDefault: true },
    include: { tiers: { orderBy: { minDays: "asc" } } },
  });
}

export async function getProfilesForSelect() {
  return prisma.pricingProfile.findMany({
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export type ProfileSelectEntry = Awaited<ReturnType<typeof getProfilesForSelect>>[number];

/** Convert Prisma Decimal tiers into plain-number tiers for the pricing helpers. */
export function toTiersLite(
  tiers: { minDays: number; multiplier: unknown }[] | null | undefined
): PricingTierLite[] | null {
  if (!tiers || tiers.length === 0) return null;
  return tiers.map((t) => ({ minDays: t.minDays, multiplier: Number(t.multiplier) }));
}
