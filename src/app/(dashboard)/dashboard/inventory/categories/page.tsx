import { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCategories } from "@/server/queries/inventory";
import { CategoriesClient } from "@/components/inventory/categories-client";

export const metadata: Metadata = { title: "Inventory categories" };

export default async function InventoryCategoriesPage() {
  const categories = await getCategories();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/inventory">
            <ChevronLeft className="h-4 w-4" />
            Back to inventory
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">
          Inventory categories
        </h1>
      </div>

      <div className="max-w-xl">
        <CategoriesClient categories={categories} />
      </div>
    </div>
  );
}
