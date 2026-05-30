import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getItems, getCategories } from "@/server/queries/inventory";

export const metadata: Metadata = { title: "Inventory" };

interface PageProps {
  searchParams: Promise<{
    categoryId?: string;
    trackingMode?: string;
    q?: string;
  }>;
}

const trackingBadge = {
  SERIALIZED: { label: "Serialized", className: "bg-blue-50 text-blue-700 border-blue-200" },
  BULK: { label: "Bulk", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

function formatCents(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function InventoryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { categoryId, trackingMode, q } = params;

  const [items, categories] = await Promise.all([
    getItems({
      categoryId: categoryId || undefined,
      trackingMode:
        trackingMode === "SERIALIZED" || trackingMode === "BULK"
          ? trackingMode
          : undefined,
      search: q || undefined,
    }),
    getCategories(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">{items.length} items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/inventory/categories">
              <Tag className="h-4 w-4 mr-1" />
              Categories
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/inventory/new">
              <Plus className="h-4 w-4 mr-1" />
              Add item
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search items…"
          className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <select
          name="categoryId"
          defaultValue={categoryId ?? ""}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          name="trackingMode"
          defaultValue={trackingMode ?? ""}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All types</option>
          <option value="SERIALIZED">Serialized</option>
          <option value="BULK">Bulk</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Filter
        </Button>
        {(categoryId || trackingMode || q) && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/inventory">Clear</Link>
          </Button>
        )}
      </form>

      {/* Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Name / Code</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty / Units</TableHead>
              <TableHead className="text-right">Daily rate</TableHead>
              <TableHead className="text-right">Replacement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No inventory items found.
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => {
              const badge = trackingBadge[item.trackingMode];
              return (
                <TableRow key={item.id}>
                  <TableCell className="p-2">
                    {item.images[0] ? (
                      <div className="relative w-10 h-10 rounded overflow-hidden bg-slate-100 flex-shrink-0">
                        <Image
                          src={item.images[0].url}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-100 flex-shrink-0" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/inventory/${item.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {item.name}
                    </Link>
                    <div className="text-xs text-muted-foreground font-mono">
                      {item.refCode}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{item.category.name}</span>
                    {item.subCategory && (
                      <span className="text-xs text-muted-foreground block">
                        {item.subCategory.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={badge.className}>
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.trackingMode === "BULK"
                      ? item.totalQuantity
                      : item._count.serializedUnits}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCents(item.dailyRateAmount, item.dailyRateCurrency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCents(
                      item.replacementCostAmount,
                      item.replacementCostCurrency
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
