import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canDo } from "@/lib/permissions";
import { getPricingProfiles } from "@/server/queries/pricing";
import { PricingProfilesClient } from "@/components/pricing/pricing-profiles-client";

export const metadata: Metadata = { title: "Pricing Profiles" };

export default async function PricingPage() {
  const session = await auth();
  if (!(await canDo(session, "INVENTORY", "READ"))) redirect("/dashboard");

  const canManage = await canDo(session, "INVENTORY_PRICING", "MANAGE");
  const profiles = await getPricingProfiles();

  // Convert Decimal multipliers to numbers for the client
  const plain = profiles.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isDefault: p.isDefault,
    isSystem: p.isSystem,
    usageCount: p._count.inventoryItems + p._count.projectEquipment,
    tiers: p.tiers.map((t) => ({ minDays: t.minDays, multiplier: Number(t.multiplier) })),
  }));

  return <PricingProfilesClient profiles={plain} canManage={canManage} />;
}
