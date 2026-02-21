"use client";

import { useState } from "react";
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
import { addEquipmentItem, removeEquipmentItem } from "@/server/actions/projects";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import type { ProjectDetail } from "@/server/queries/projects";
import type { ItemListEntry } from "@/server/queries/inventory";

interface KitListClientProps {
  projectId: string;
  equipmentItems: NonNullable<ProjectDetail>["equipmentItems"];
  inventoryItems: ItemListEntry[];
  projectCurrency: string;
}

function formatCents(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export function KitListClient({
  projectId,
  equipmentItems,
  inventoryItems,
  projectCurrency,
}: KitListClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const form = useForm<EquipmentItemFormValues>({
    resolver: zodResolver(equipmentItemSchema),
    defaultValues: {
      inventoryItemId: "",
      quantityNeeded: 1,
      unitRateAmount: undefined,
      unitRateCurrency: projectCurrency,
      rateType: "DAILY",
      rateDays: 1,
      description: "",
      notes: "",
    },
  });

  const watchedItemId = form.watch("inventoryItemId");
  const selectedInvItem = inventoryItems.find((i) => i.id === watchedItemId);

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

  const kitTotal = equipmentItems.reduce((sum, item) => {
    return sum + (item.unitRateAmount ?? 0) * item.rateDays * item.quantityNeeded;
  }, 0);

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
              const lineTotal = (item.unitRateAmount ?? 0) * item.rateDays * item.quantityNeeded;
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
                    {formatCents(lineTotal, item.unitRateCurrency ?? projectCurrency)}
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
        <div className="mt-2 text-right text-sm font-semibold text-slate-700">
          Kit total: {formatCents(kitTotal, projectCurrency)}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
    </div>
  );
}
