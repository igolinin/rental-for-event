import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectById, computeProjectPnL, toDiscountSpec } from "@/server/queries/projects";
import { getItems } from "@/server/queries/inventory";
import { getCrewForSelect } from "@/server/queries/crew";
import { getPricingProfiles, getDefaultProfile, toTiersLite } from "@/server/queries/pricing";
import type { PricingTierLite } from "@/lib/pricing";
import type { DiscountSpec } from "@/lib/discounts";
import { serializeDecimals } from "@/lib/serialize";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProjectById(id);
  return { title: project?.name ?? "Project" };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [project, inventoryItems, crewForSelect, profiles, defaultProfile] = await Promise.all([
    getProjectById(id),
    getItems({ isActive: true }),
    getCrewForSelect(),
    getPricingProfiles(),
    getDefaultProfile(),
  ]);

  if (!project) notFound();

  const defaultTiers = toTiersLite(defaultProfile?.tiers);
  const pnl = computeProjectPnL(project, defaultTiers);

  // Build a profileId → tiers map for live computation in the kit list dialog
  const profileTiers: Record<string, PricingTierLite[]> = {};
  for (const p of profiles) {
    const lite = toTiersLite(p.tiers);
    if (lite) profileTiers[p.id] = lite;
  }

  // Plain discount specs for the client (avoid passing Prisma Decimals)
  const projectDiscount = toDiscountSpec(project.discountPercent, project.discountFixed);
  const categoryDiscounts: Record<string, DiscountSpec> = {};
  for (const cd of project.categoryDiscounts) {
    const spec = toDiscountSpec(cd.discountPercent, cd.discountFixed);
    if (spec) categoryDiscounts[cd.categoryId] = spec;
  }

  // Categories present in the kit (for the discount manager UI)
  const kitCategories = Array.from(
    new Map(project.equipmentItems.map((i) => [i.inventoryItem.categoryId, i.inventoryItem.category.name])).entries()
  ).map(([id, name]) => ({ id, name }));

  return (
    <ProjectDetailClient
      project={serializeDecimals(project)}
      pnl={pnl}
      inventoryItems={inventoryItems}
      crewForSelect={crewForSelect}
      pricingProfiles={profiles.map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault }))}
      profileTiers={profileTiers}
      defaultProfileId={defaultProfile?.id ?? null}
      projectDiscount={projectDiscount}
      categoryDiscounts={categoryDiscounts}
      kitCategories={kitCategories}
    />
  );
}
