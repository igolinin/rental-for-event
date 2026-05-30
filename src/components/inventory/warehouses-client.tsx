"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil } from "lucide-react";
import { warehouseSchema, type WarehouseFormValues } from "@/schemas/warehouses";
import { createWarehouse, updateWarehouse, toggleWarehouseActive } from "@/server/actions/warehouses";
import { toast } from "@/hooks/use-toast";
import type { WarehouseListEntry } from "@/server/queries/warehouses";

interface WarehousesClientProps {
  warehouses: WarehouseListEntry[];
}

export function WarehousesClient({ warehouses }: WarehousesClientProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editWarehouse, setEditWarehouse] = useState<WarehouseListEntry | null>(null);
  const [isPending, setIsPending] = useState(false);

  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: { name: "", address: "", city: "", country: "", isActive: true },
  });

  async function onCreateSubmit(values: WarehouseFormValues) {
    setIsPending(true);
    try {
      const result = await createWarehouse(values);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error creating warehouse" });
        return;
      }
      toast({ title: "Warehouse created" });
      setCreateOpen(false);
      form.reset();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  function openEdit(w: WarehouseListEntry) {
    setEditWarehouse(w);
    form.reset({ name: w.name, address: w.address ?? "", city: w.city ?? "", country: w.country ?? "", isActive: w.isActive });
  }

  async function onEditSubmit(values: WarehouseFormValues) {
    if (!editWarehouse) return;
    setIsPending(true);
    try {
      const result = await updateWarehouse(editWarehouse.id, values);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error updating warehouse" });
        return;
      }
      toast({ title: "Warehouse updated" });
      setEditWarehouse(null);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleToggleActive(id: string, current: boolean) {
    await toggleWarehouseActive(id, !current);
    toast({ title: current ? "Warehouse deactivated" : "Warehouse activated" });
    router.refresh();
  }

  const isEditing = !!editWarehouse;
  const dialogOpen = createOpen || isEditing;

  function WarehouseForm({ onCancel }: { onCancel: () => void }) {
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(isEditing ? onEditSubmit : onCreateSubmit)} className="space-y-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl><Input placeholder="Main Warehouse" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="city" render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl><Input value={field.value ?? ""} onChange={field.onChange} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="country" render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl><Input value={field.value ?? ""} onChange={field.onChange} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="address" render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl><Input value={field.value ?? ""} onChange={field.onChange} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          {isEditing && (
            <FormField control={form.control} name="isActive" render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormLabel>Active</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEditing ? "Save changes" : "Create warehouse"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Warehouses</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage storage locations for equipment</p>
        </div>
        <Button onClick={() => { form.reset(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          New warehouse
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Country</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehouses.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                  No warehouses configured.
                </TableCell>
              </TableRow>
            )}
            {warehouses.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-medium text-sm">{w.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{w.city ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{w.country ?? "—"}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {w._count.serializedUnits}
                </TableCell>
                <TableCell>
                  {w.isActive ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-xs">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(w)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleToggleActive(w.id, w.isActive)}
                    >
                      {w.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setCreateOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New warehouse</DialogTitle></DialogHeader>
          <WarehouseForm onCancel={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={isEditing} onOpenChange={(o) => { if (!o) setEditWarehouse(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit — {editWarehouse?.name}</DialogTitle></DialogHeader>
          <WarehouseForm onCancel={() => setEditWarehouse(null)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
