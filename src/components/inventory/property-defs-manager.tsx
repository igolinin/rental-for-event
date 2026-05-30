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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { propertyDefSchema, type PropertyDefFormValues } from "@/schemas/inventory";
import { createPropertyDef, deletePropertyDef } from "@/server/actions/inventory";
import { toast } from "@/hooks/use-toast";
import type { PropertyDefEntry } from "@/server/queries/inventory";

const typeBadge: Record<string, { label: string; className: string }> = {
  TEXT: { label: "Text", className: "bg-slate-100 text-slate-600 border-slate-200" },
  NUMERIC: { label: "Number", className: "bg-blue-50 text-blue-700 border-blue-200" },
  BOOLEAN: { label: "Yes / No", className: "bg-green-50 text-green-700 border-green-200" },
};

interface PropertyDefsManagerProps {
  propertyDefs: PropertyDefEntry[];
}

export function PropertyDefsManager({ propertyDefs }: PropertyDefsManagerProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const form = useForm<PropertyDefFormValues>({
    resolver: zodResolver(propertyDefSchema),
    defaultValues: { name: "", valueType: "TEXT", unit: "" },
  });

  const watchedType = form.watch("valueType");

  async function onSubmit(values: PropertyDefFormValues) {
    setIsPending(true);
    try {
      const result = await createPropertyDef(values);
      if ("error" in result && result.error) {
        const msg = typeof result.error === "string" ? result.error : "Error creating property";
        toast({ variant: "destructive", title: msg });
        return;
      }
      toast({ title: "Property type created" });
      setDialogOpen(false);
      form.reset();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(id: string) {
    const result = await deletePropertyDef(id);
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: typeof result.error === "string" ? result.error : "Cannot delete" });
      return;
    }
    toast({ title: "Property type deleted" });
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <p className="text-sm font-medium">
          {propertyDefs.length} {propertyDefs.length === 1 ? "property type" : "property types"} defined
        </p>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New property type
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Used on items</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {propertyDefs.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="h-16 text-center text-muted-foreground text-sm">
                No property types defined yet.
              </TableCell>
            </TableRow>
          )}
          {propertyDefs.map((def) => {
            const tb = typeBadge[def.valueType];
            return (
              <TableRow key={def.id}>
                <TableCell className="font-medium text-sm">{def.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${tb.className}`}>{tb.label}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{def.unit ?? "—"}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{def._count.values}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={def._count.values > 0}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete &quot;{def.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This property type will be removed. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(def.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New property type</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Power, Weight, IP Rating" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="valueType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="TEXT">Text</SelectItem>
                        <SelectItem value="NUMERIC">Number</SelectItem>
                        <SelectItem value="BOOLEAN">Yes / No</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {watchedType === "NUMERIC" && (
                  <FormField control={form.control} name="unit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <Input placeholder="W, kg, dB…" value={field.value ?? ""} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
