import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemForm } from "@/components/inventory/item-form";
import { getItemById, getCategories } from "@/server/queries/inventory";
import { getProfilesForSelect } from "@/server/queries/pricing";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const item = await getItemById(id);
  return { title: item ? `Edit — ${item.name}` : "Edit item" };
}

export default async function EditInventoryItemPage({ params }: PageProps) {
  const { id } = await params;
  const [item, categories, pricingProfiles] = await Promise.all([
    getItemById(id),
    getCategories(),
    getProfilesForSelect(),
  ]);

  if (!item) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/inventory/${id}`}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Edit: {item.name}</h1>
      </div>

      <div className="max-w-2xl">
        <ItemForm
          categories={categories}
          itemId={id}
          pricingProfiles={pricingProfiles}
          defaultValues={{
            name: item.name,
            description: item.description ?? "",
            categoryId: item.categoryId,
            subCategoryId: item.subCategoryId ?? "",
            trackingMode: item.trackingMode,
            totalQuantity: item.totalQuantity,
            dailyRateAmount: item.dailyRateAmount ?? undefined,
            dailyRateCurrency: item.dailyRateCurrency,
            replacementCostAmount: item.replacementCostAmount ?? undefined,
            replacementCostCurrency: item.replacementCostCurrency,
            pricingProfileId: item.pricingProfileId ?? "",
            notes: item.notes ?? "",
            isActive: item.isActive,
          }}
        />
      </div>
    </div>
  );
}
