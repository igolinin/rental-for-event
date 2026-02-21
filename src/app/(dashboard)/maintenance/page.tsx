import { Metadata } from "next";
import Link from "next/link";
import { getMaintenanceLogs, getCategories } from "@/server/queries/inventory";
import { MaintenanceQueueClient } from "@/components/inventory/maintenance-queue-client";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";

export const metadata: Metadata = { title: "Maintenance" };

interface PageProps {
  searchParams: Promise<{
    status?: string;
    categoryId?: string;
  }>;
}

export default async function MaintenancePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { status, categoryId } = params;

  const validStatus =
    status === "OPEN" ||
    status === "IN_PROGRESS" ||
    status === "COMPLETED" ||
    status === "CANCELLED"
      ? status
      : undefined;

  const [logs, categories] = await Promise.all([
    getMaintenanceLogs({ status: validStatus, categoryId }),
    getCategories(),
  ]);

  const openCount = logs.filter((l) => l.status === "OPEN").length;
  const inProgressCount = logs.filter((l) => l.status === "IN_PROGRESS").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {openCount} open · {inProgressCount} in progress
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/inventory">
            <Package className="h-4 w-4 mr-1" />
            Go to inventory
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 mb-4">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Open &amp; In progress</option>
          <option value="OPEN">Open only</option>
          <option value="IN_PROGRESS">In progress only</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
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
        <Button type="submit" variant="outline" size="sm">
          Filter
        </Button>
        {(status || categoryId) && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/maintenance">Clear</Link>
          </Button>
        )}
      </form>

      <MaintenanceQueueClient logs={logs} />
    </div>
  );
}
