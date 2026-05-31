"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
import { equipmentItemSchema, type EquipmentItemFormValues } from "@/schemas/projects";
import { addEquipmentItem, removeEquipmentItem, fetchSerializedUnitsForKitItem, updateEquipmentAllocation, checkItemAvailability } from "@/server/actions/projects";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Tag } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProjectDetail } from "@/server/queries/projects";
import type { ItemListEntry } from "@/server/queries/inventory";
import { computeLineTotal, type PricingTierLite } from "@/lib/pricing";
import { computeLineDiscounts, type DiscountSpec, type DiscountLineInput } from "@/lib/discounts";

interface PricingProfileLite { id: string; name: string; isDefault: boolean }

interface KitListClientProps {
  projectId: string;
  equipmentItems: NonNullable<ProjectDetail>["equipmentItems"];
  inventoryItems: ItemListEntry[];
  projectCurrency: string;
  pricingProfiles: PricingProfileLite[];
  profileTiers: Record<string, PricingTierLite[]>;
  defaultProfileId: string | null;
  projectDiscount: DiscountSpec | null;
  categoryDiscounts: Record<string, DiscountSpec>;
}

function formatCents(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

type SerializedUnit = {
  id: string;
  serialNumber: string;
  assetTag: string | null;
  status: string;
  isAssignedToThisItem: boolean;
  isAvailable: boolean;
};

export function KitListClient({
  projectId,
  equipmentItems,
  inventoryItems,
  projectCurrency,
  pricingProfiles,
  profileTiers,
  defaultProfileId,
  projectDiscount,
  categoryDiscounts,
}: KitListClientProps) {
  const router = useRouter();

  // Resolve the curve tiers for a line: line override → item profile → default.
  function resolveLineTiers(
    lineProfileId: string | null | undefined,
    itemProfileId: string | null | undefined
  ): PricingTierLite[] | null {
    const id = lineProfileId || itemProfileId || defaultProfileId;
    return (id && profileTiers[id]) || null;
  }
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [availInfo, setAvailInfo] = useState<{ available: number; checked: boolean; loading: boolean }>({
    available: 0,
    checked: false,
    loading: false,
  });
  const availTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [allocDialogOpen, setAllocDialogOpen] = useState(false);
  const [allocKitItemId, setAllocKitItemId] = useState<string | null>(null);
  const [allocUnits, setAllocUnits] = useState<SerializedUnit[]>([]);
  const [allocSelected, setAllocSelected] = useState<Set<string>>(new Set());
  const [allocLoading, setAllocLoading] = useState(false);
  const [allocSaving, setAllocSaving] = useState(false);

  const form = useForm<EquipmentItemFormValues>({
    resolver: zodResolver(equipmentItemSchema),
    defaultValues: {
      inventoryItemId: "",
      quantityNeeded: 1,
      unitRateAmount: undefined,
      unitRateCurrency: projectCurrency,
      rateType: "DAILY",
      rateDays: 1,
      pricingProfileId: "",
      discountPercent: undefined,
      discountFixed: undefined,
      description: "",
      notes: "",
    },
  });

  const watchedItemId = form.watch("inventoryItemId");
  const selectedInvItem = inventoryItems.find((i) => i.id === watchedItemId);
  const watchedProfileId = form.watch("pricingProfileId");
  const watchedQty = form.watch("quantityNeeded");
  const watchedRate = form.watch("unitRateAmount");
  const watchedDays = form.watch("rateDays");
  const watchedRateType = form.watch("rateType");
  const watchedDiscPct = form.watch("discountPercent");
  const watchedDiscFixed = form.watch("discountFixed");

  // Live line-total preview using the resolved curve
  const previewTiers = resolveLineTiers(
    watchedProfileId || null,
    selectedInvItem?.pricingProfileId ?? null
  );
  const previewGross = computeLineTotal(
    Number(watchedRate ?? selectedInvItem?.dailyRateAmount ?? 0),
    Number(watchedDays ?? 1),
    Number(watchedQty ?? 1),
    previewTiers,
    watchedRateType ?? "DAILY"
  );
  // Item lock disables discount entirely
  const itemLocked = (selectedInvItem as { noDiscount?: boolean } | undefined)?.noDiscount ?? false;
  const previewDiscount = itemLocked
    ? 0
    : watchedDiscPct
    ? Math.min(Math.round(previewGross * Number(watchedDiscPct)), previewGross)
    : watchedDiscFixed
    ? Math.min(Number(watchedDiscFixed), previewGross)
    : 0;
  const previewTotal = previewGross - previewDiscount;

  useEffect(() => {
    if (!watchedItemId) {
      setAvailInfo({ available: 0, checked: false, loading: false });
      return;
    }
    setAvailInfo((prev) => ({ ...prev, loading: true, checked: false }));
    if (availTimeout.current) clearTimeout(availTimeout.current);
    availTimeout.current = setTimeout(async () => {
      const result = await checkItemAvailability(watchedItemId, projectId);
      setAvailInfo({ available: result.available, checked: true, loading: false });
    }, 300);
  }, [watchedItemId, projectId]);

  async function onSubmit(values: EquipmentItemFormValues) {
    setIsPending(true);
    try {
      const result = await addEquipmentItem(projectId, values);
      if ("error" in result && result.error) {
        const msg = typeof result.error === "string" ? result.error : "Error adding item";
        toast({ variant: "destructive", title: msg });
        return;
      }
      toast({ title: "Item added to kit list" });
      setDialogOpen(false);
      form.reset();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleRemove(lineItemId: string) {
    await removeEquipmentItem(lineItemId, projectId);
    toast({ title: "Item removed" });
    router.refresh();
  }

  async function openAllocDialog(kitItemId: string) {
    setAllocKitItemId(kitItemId);
    setAllocDialogOpen(true);
    setAllocLoading(true);
    try {
      const result = await fetchSerializedUnitsForKitItem(kitItemId);
      if ("error" in result) {
        toast({ variant: "destructive", title: result.error });
        setAllocDialogOpen(false);
        return;
      }
      setAllocUnits(result.units);
      setAllocSelected(new Set(result.units.filter((u) => u.isAssignedToThisItem).map((u) => u.id)));
    } finally {
      setAllocLoading(false);
    }
  }

  async function saveAllocation() {
    if (!allocKitItemId) return;
    setAllocSaving(true);
    try {
      const result = await updateEquipmentAllocation(allocKitItemId, [...allocSelected], projectId);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: String(result.error) });
        return;
      }
      toast({ title: "Unit assignments saved" });
      setAllocDialogOpen(false);
      router.refresh();
    } finally {
      setAllocSaving(false);
    }
  }

  function toggleUnit(id: string) {
    setAllocSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function grossFor(item: NonNullable<ProjectDetail>["equipmentItems"][number]): number {
    const tiers = resolveLineTiers(item.pricingProfileId, item.inventoryItem.pricingProfileId);
    return computeLineTotal(item.unitRateAmount ?? 0, item.rateDays, item.quantityNeeded, tiers, item.rateType);
  }

  // Resolve per-line discounts (line → category → project), respecting locks.
  const discountInputs: DiscountLineInput[] = equipmentItems.map((item) => ({
    id: item.id,
    lineTotal: grossFor(item),
    categoryId: item.inventoryItem.categoryId,
    locked: (item.inventoryItem as { noDiscount?: boolean }).noDiscount ?? false,
    lineDiscount:
      item.discountPercent != null || item.discountFixed != null
        ? { percent: item.discountPercent != null ? Number(item.discountPercent) : null, fixed: item.discountFixed ?? null }
        : null,
  }));
  const { perLine: lineDiscounts } = computeLineDiscounts(discountInputs, categoryDiscounts, projectDiscount);

  const kitGross = equipmentItems.reduce((sum, item) => sum + grossFor(item), 0);
  const kitDiscount = Object.values(lineDiscounts).reduce((s, v) => s + v, 0);
  const kitTotal = kitGross - kitDiscount;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add item
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit rate</TableHead>
              <TableHead>Rate type</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead className="text-right">Line total</TableHead>
              <TableHead>Units</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipmentItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-16 text-center text-muted-foreground">
                  No equipment in kit list. Add items above.
                </TableCell>
              </TableRow>
            )}
            {equipmentItems.map((item) => {
              const gross = grossFor(item);
              const discount = lineDiscounts[item.id] ?? 0;
              const lineTotal = gross - discount;
              const cur = item.unitRateCurrency ?? projectCurrency;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">
                    {item.inventoryItem.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.inventoryItem.category.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantityNeeded}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCents(item.unitRateAmount, item.unitRateCurrency ?? projectCurrency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {item.rateType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.rateDays}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {discount > 0 ? (
                      <div>
                        <span className="text-muted-foreground line-through text-xs mr-1">
                          {formatCents(gross, cur)}
                        </span>
                        {formatCents(lineTotal, cur)}
                        <div className="text-[10px] text-red-600">−{formatCents(discount, cur)}</div>
                      </div>
                    ) : (
                      formatCents(lineTotal, cur)
                    )}
                  </TableCell>
                  <TableCell>
                    {item.inventoryItem.trackingMode === "SERIALIZED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        title="Assign specific units"
                        onClick={() => openAllocDialog(item.id)}
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {item.allocations.length > 0
                          ? item.allocations.map((a) => a.serializedUnit.serialNumber).join(", ")
                          : "Assign"}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove from kit list?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove {item.inventoryItem.name} from the project.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemove(item.id)}>
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {equipmentItems.length > 0 && (
        <div className="mt-2 text-right text-sm space-y-0.5">
          {kitDiscount > 0 && (
            <>
              <div className="text-muted-foreground">Gross: {formatCents(kitGross, projectCurrency)}</div>
              <div className="text-red-600">Discount: −{formatCents(kitDiscount, projectCurrency)}</div>
            </>
          )}
          <div className="font-semibold text-slate-700">Kit total: {formatCents(kitTotal, projectCurrency)}</div>
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setAvailInfo({ available: 0, checked: false, loading: false }); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add equipment to kit list</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="inventoryItemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inventory item *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {inventoryItems.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.name} ({inv.category.name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantityNeeded"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity *</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                      {availInfo.loading && (
                        <p className="text-xs text-muted-foreground mt-1">Checking availability…</p>
                      )}
                      {availInfo.checked && !availInfo.loading && (
                        <p className={`text-xs mt-1 ${
                          availInfo.available === 0
                            ? "text-red-600"
                            : availInfo.available <= 2
                            ? "text-amber-600"
                            : "text-green-700"
                        }`}>
                          {availInfo.available === 0
                            ? "Not available for your project dates"
                            : availInfo.available <= 2
                            ? `Only ${availInfo.available} available for your project dates`
                            : `${availInfo.available} available for your project dates`}
                        </p>
                      )}
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rateType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="DAILY">Daily</SelectItem>
                          <SelectItem value="WEEKLY">Weekly</SelectItem>
                          <SelectItem value="FLAT">Flat</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unitRateAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Unit rate (cents)
                        {selectedInvItem?.dailyRateAmount
                          ? ` — default: ${selectedInvItem.dailyRateAmount}`
                          : ""}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder={
                            selectedInvItem?.dailyRateAmount?.toString() ?? "0"
                          }
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? null : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rateDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of days</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pricingProfileId"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Pricing curve</FormLabel>
                      <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Inherit from item / default" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Inherit from item / default</SelectItem>
                          {pricingProfiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}{p.isDefault ? " (default)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Line discount (percent OR fixed). Disabled when the item is locked. */}
                <FormField
                  control={form.control}
                  name="discountPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount %</FormLabel>
                      <FormControl>
                        <Input
                          type="number" min={0} max={100} step={1}
                          placeholder="e.g. 15"
                          disabled={itemLocked || !!watchedDiscFixed}
                          value={field.value != null ? Math.round(Number(field.value) * 100) : ""}
                          onChange={(e) =>
                            field.onChange(e.target.value === "" ? null : Number(e.target.value) / 100)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="discountFixed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount fixed (cents)</FormLabel>
                      <FormControl>
                        <Input
                          type="number" min={0}
                          placeholder="e.g. 5000 = $50"
                          disabled={itemLocked || !!watchedDiscPct}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value === "" ? null : Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {itemLocked && (
                <p className="text-xs text-amber-600">
                  This item is locked from discounts (consumable).
                </p>
              )}

              {/* Live curve + discount preview */}
              <div className="rounded-md bg-slate-50 border px-3 py-2 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Gross{watchedRateType !== "FLAT" && previewTiers ? " (curve applied)" : ""}
                  </span>
                  <span className="tabular-nums">{formatCents(previewGross, projectCurrency)}</span>
                </div>
                {previewDiscount > 0 && (
                  <div className="flex items-center justify-between text-red-600">
                    <span>Discount</span>
                    <span className="tabular-nums">−{formatCents(previewDiscount, projectCurrency)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between font-semibold border-t pt-1">
                  <span>Line total</span>
                  <span className="tabular-nums">{formatCents(previewTotal, projectCurrency)}</span>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Adding…" : "Add to kit"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Assign serialized units dialog */}
      <Dialog open={allocDialogOpen} onOpenChange={setAllocDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign units</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {allocLoading && <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>}
            {!allocLoading && allocUnits.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No serialized units found for this item.</p>
            )}
            {!allocLoading && allocUnits.map((unit) => (
              <label
                key={unit.id}
                className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer ${
                  !unit.isAvailable && !unit.isAssignedToThisItem
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-slate-50"
                }`}
              >
                <Checkbox
                  checked={allocSelected.has(unit.id)}
                  onCheckedChange={() => (unit.isAvailable || unit.isAssignedToThisItem) && toggleUnit(unit.id)}
                  disabled={!unit.isAvailable && !unit.isAssignedToThisItem}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium font-mono">{unit.serialNumber}</p>
                  {unit.assetTag && <p className="text-xs text-muted-foreground">{unit.assetTag}</p>}
                </div>
                <Badge
                  variant="outline"
                  className={
                    unit.isAssignedToThisItem
                      ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                      : unit.isAvailable
                      ? "bg-green-50 text-green-700 border-green-200 text-xs"
                      : "bg-red-50 text-red-600 border-red-200 text-xs"
                  }
                >
                  {unit.isAssignedToThisItem ? "Assigned" : unit.isAvailable ? unit.status : "Unavailable"}
                </Badge>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveAllocation} disabled={allocSaving || allocLoading}>
              {allocSaving ? "Saving…" : "Save assignments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
