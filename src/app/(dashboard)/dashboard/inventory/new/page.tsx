import { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemForm } from "@/components/inventory/item-form";
import { getCategories } from "@/server/queries/inventory";
import { getProfilesForSelect } from "@/server/queries/pricing";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Add inventory item" };

const AI_PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude",
  openai: "GPT-4o",
  deepseek: "DeepSeek",
};

export default async function NewInventoryItemPage() {
  const [categories, settings, pricingProfiles] = await Promise.all([
    getCategories(),
    prisma.systemSettings.findUnique({ where: { id: "singleton" }, select: { aiProvider: true, aiApiKey: true } }),
    getProfilesForSelect(),
  ]);
  const aiProviderLabel =
    settings?.aiProvider && settings.aiApiKey
      ? (AI_PROVIDER_LABELS[settings.aiProvider] ?? settings.aiProvider)
      : null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/inventory">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Add inventory item</h1>
      </div>

      <div className="max-w-2xl">
        <ItemForm categories={categories} aiProviderLabel={aiProviderLabel} pricingProfiles={pricingProfiles} />
      </div>
    </div>
  );
}
