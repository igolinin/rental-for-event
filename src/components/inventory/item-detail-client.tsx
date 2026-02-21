"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UnitFormDialog } from "@/components/inventory/unit-form";
import { MaintenanceLogFormDialog } from "@/components/inventory/maintenance-log-form";
import {
  deleteSerializedUnit,
  updateMaintenanceLogStatus,
  archiveInventoryItem,
} from "@/server/actions/inventory";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Wrench,
  ChevronLeft,
} from "lucide-react";
import type { ItemDetail } from "@/server/queries/inventory";
import { formatDate } from "@/lib/utils";

interface ItemDetailClientProps {
  item: NonNullable<ItemDetail>;
}

const unitStatusBadge: Record<string, { label: string; className: string }> = {
  AVAILABLE: { label: "Available", className: "bg-green-50 text-green-700 border-green-200" },
  IN_SERVICE: { label: "In service", className: "bg-blue-50 text-blue-700 border-blue-200" },
  IN_REPAIR: { label: "In repair", className: "bg-red-50 text-red-700 border-red-200" },
  RETIRED: { label: "Retired", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

const maintenanceStatusBadge: Record<string, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-red-50 text-red-700 border-red-200" },
  IN_PROGRESS: { label: "In progress", className: "bg-amber-50 text-amber-700 border-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-green-50 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

function formatCents(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export function ItemDetailClient({ item }: ItemDetailClientProps) {
  const router = useRouter();
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<
    | (NonNullable<ItemDetail>["serializedUnits"][number] & { id: string })
    | null
  >(null);

  async function handleDeleteUnit(unitId: string) {
    const result = await deleteSerializedUnit(unitId, item.id);
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: String(result.error) });
    } else {
      toast({ title: "Unit deleted" });
      router.refresh();
    }
  }

  async function handleMaintenanceStatus(
    logId: string,
    status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  ) {
    const result = await updateMaintenanceLogStatus(logId, status);
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: String(result.error) });
    } else {
      toast({ title: "Status updated" });
      router.refresh();
    }
  }

  async function handleArchive() {
    await archiveInventoryItem(item.id);
    toast({ title: "Item archived" });
    router.push("/dashboard/inventory");
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/inventory">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{item.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs text-muted-foreground">
                {item.refCode}
              </span>
              <Badge variant="outline">
                {item.trackingMode === "SERIALIZED" ? "Serialized" : "Bulk"}
              </Badge>
              <Badge variant="outline">
                {item.category.name}
                {item.subCategory ? ` › ${item.subCategory.name}` : ""}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/inventory/${item.id}/edit`}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                Archive
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive item?</AlertDialogTitle>
                <AlertDialogDescription>
                  The item will be hidden from the inventory list but historical
                  data is preserved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchive}>
                  Archive
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Daily rate",
            value: formatCents(item.dailyRateAmount, item.dailyRateCurrency),
          },
          {
            label: "Replacement cost",
            value: formatCents(
              item.replacementCostAmount,
              item.replacementCostCurrency
            ),
          },
          {
            label: item.trackingMode === "BULK" ? "Total qty" : "Total units",
            value:
              item.trackingMode === "BULK"
                ? item.totalQuantity
                : item.serializedUnits.length,
          },
          {
            label: "Available",
            value:
              item.trackingMode === "BULK"
                ? item.totalQuantity
                : item.serializedUnits.filter((u) => u.status === "AVAILABLE")
                    .length,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border bg-white p-4"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue={item.trackingMode === "SERIALIZED" ? "units" : "overview"}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {item.trackingMode === "SERIALIZED" && (
            <TabsTrigger value="units">
              Units ({item.serializedUnits.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="maintenance">
            Maintenance ({item.maintenanceLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4">
          <div className="rounded-lg border bg-white p-6 space-y-4 max-w-xl">
            {item.description && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Description
                </p>
                <p className="text-sm">{item.description}</p>
              </div>
            )}
            {item.notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Internal notes
                </p>
                <p className="text-sm">{item.notes}</p>
              </div>
            )}
            {!item.description && !item.notes && (
              <p className="text-sm text-muted-foreground">
                No description or notes.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Serialized Units */}
        {item.trackingMode === "SERIALIZED" && (
          <TabsContent value="units" className="mt-4">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => { setEditingUnit(null); setUnitDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />
                Add unit
              </Button>
            </div>
            <div className="rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial number</TableHead>
                    <TableHead>Asset tag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Purchase date</TableHead>
                    <TableHead className="text-right">Purchase price</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.serializedUnits.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                        No units added yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {item.serializedUnits.map((unit) => {
                    const badge = unitStatusBadge[unit.status];
                    return (
                      <TableRow key={unit.id}>
                        <TableCell className="font-mono text-sm">
                          {unit.serialNumber}
                        </TableCell>
                        <TableCell className="text-sm">
                          {unit.assetTag ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={badge.className}>
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(unit.purchaseDate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatCents(
                            unit.purchasePriceAmount,
                            unit.purchasePriceCurrency
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingUnit(unit as typeof unit & { id: string });
                                  setUnitDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteUnit(unit.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}

        {/* Maintenance */}
        <TabsContent value="maintenance" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setMaintenanceDialogOpen(true)}>
              <Wrench className="h-4 w-4 mr-1" />
              Log maintenance
            </Button>
          </div>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reported</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.maintenanceLogs.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-16 text-center text-muted-foreground"
                    >
                      No maintenance logs.
                    </TableCell>
                  </TableRow>
                )}
                {item.maintenanceLogs.map((log) => {
                  const badge = maintenanceStatusBadge[log.status];
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm font-medium">
                        {log.type.replace("_", " ")}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {log.description}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.serializedUnit?.serialNumber ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(log.reportedAt)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCents(log.costAmount, log.costCurrency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(log.status === "OPEN" ||
                          log.status === "IN_PROGRESS") && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {log.status === "OPEN" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleMaintenanceStatus(log.id, "IN_PROGRESS")
                                  }
                                >
                                  Mark in progress
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() =>
                                  handleMaintenanceStatus(log.id, "COMPLETED")
                                }
                              >
                                Mark completed
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() =>
                                  handleMaintenanceStatus(log.id, "CANCELLED")
                                }
                              >
                                Cancel
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <UnitFormDialog
        inventoryItemId={item.id}
        open={unitDialogOpen}
        onOpenChange={(open) => {
          setUnitDialogOpen(open);
          if (!open) {
            setEditingUnit(null);
            router.refresh();
          }
        }}
        defaultValues={
          editingUnit
            ? {
                id: editingUnit.id,
                serialNumber: editingUnit.serialNumber,
                assetTag: editingUnit.assetTag ?? "",
                status: editingUnit.status,
                purchaseDate: editingUnit.purchaseDate
                  ? new Date(editingUnit.purchaseDate)
                      .toISOString()
                      .slice(0, 10)
                  : "",
                purchasePriceAmount: editingUnit.purchasePriceAmount ?? undefined,
                purchasePriceCurrency: editingUnit.purchasePriceCurrency,
                notes: editingUnit.notes ?? "",
              }
            : undefined
        }
      />

      <MaintenanceLogFormDialog
        inventoryItemId={item.id}
        serializedUnits={item.serializedUnits.map((u) => ({
          id: u.id,
          serialNumber: u.serialNumber,
        }))}
        open={maintenanceDialogOpen}
        onOpenChange={(open) => {
          setMaintenanceDialogOpen(open);
          if (!open) router.refresh();
        }}
      />
    </div>
  );
}
