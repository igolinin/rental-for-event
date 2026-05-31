"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin } from "lucide-react";
import {
  serializedUnitSchema,
  type SerializedUnitFormValues,
} from "@/schemas/inventory";
import {
  addSerializedUnit,
  updateSerializedUnit,
} from "@/server/actions/inventory";
import { toast } from "@/hooks/use-toast";

interface UnitFormDialogProps {
  inventoryItemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<SerializedUnitFormValues> & { id?: string };
  warehouses?: { id: string; name: string; city: string | null }[];
}

export function UnitFormDialog({
  inventoryItemId,
  open,
  onOpenChange,
  defaultValues,
  warehouses = [],
}: UnitFormDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const isEditing = !!defaultValues?.id;

  const form = useForm<SerializedUnitFormValues>({
    resolver: zodResolver(serializedUnitSchema),
    defaultValues: {
      serialNumber: "",
      assetTag: "",
      status: "AVAILABLE",
      warehouseId: "",
      purchaseDate: "",
      purchasePriceAmount: undefined,
      purchasePriceCurrency: "USD",
      notes: "",
      ...defaultValues,
    },
  });

  async function onSubmit(values: SerializedUnitFormValues) {
    setIsPending(true);
    try {
      const unitId = defaultValues?.id;
      const result =
        isEditing && unitId
          ? await updateSerializedUnit(unitId, inventoryItemId, values)
          : await addSerializedUnit(inventoryItemId, values);

      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error saving unit" });
        return;
      }

      toast({ title: isEditing ? "Unit updated" : "Unit added" });
      onOpenChange(false);
      form.reset();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit unit" : "Add serialized unit"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial number *</FormLabel>
                    <FormControl>
                      <Input placeholder="SN12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assetTag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset tag</FormLabel>
                    <FormControl>
                      <Input placeholder="TAG-001" value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="AVAILABLE">Available</SelectItem>
                        <SelectItem value="IN_SERVICE">In service</SelectItem>
                        <SelectItem value="IN_REPAIR">In repair</SelectItem>
                        <SelectItem value="RETIRED">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {warehouses.length > 0 && (
                <FormField
                  control={form.control}
                  name="warehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warehouse</FormLabel>
                      <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No warehouse assigned" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              No warehouse
                            </span>
                          </SelectItem>
                          {warehouses.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name}{w.city ? ` (${w.city})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase date</FormLabel>
                    <FormControl>
                      <Input type="date" value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchasePriceAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase price (cents)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="e.g. 50000"
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
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} value={field.value ?? ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : isEditing ? "Save changes" : "Add unit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
