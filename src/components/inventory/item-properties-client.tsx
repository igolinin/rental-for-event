"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, SlidersHorizontal } from "lucide-react";
import { upsertItemProperty, deleteItemProperty } from "@/server/actions/inventory";
import { toast } from "@/hooks/use-toast";
import type { ItemDetail, PropertyDefEntry } from "@/server/queries/inventory";

type ItemProperty = NonNullable<ItemDetail>["properties"][number];

const typeLabel: Record<string, string> = {
  TEXT: "Text",
  NUMERIC: "Number",
  BOOLEAN: "Yes / No",
};

const typeBadge: Record<string, string> = {
  TEXT: "bg-slate-100 text-slate-600 border-slate-200",
  NUMERIC: "bg-blue-50 text-blue-700 border-blue-200",
  BOOLEAN: "bg-green-50 text-green-700 border-green-200",
};

interface ItemPropertiesClientProps {
  inventoryItemId: string;
  properties: ItemProperty[];
  allPropertyDefs: PropertyDefEntry[];
}

export function ItemPropertiesClient({
  inventoryItemId,
  properties,
  allPropertyDefs,
}: ItemPropertiesClientProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedDefId, setSelectedDefId] = useState("");
  const [pendingValue, setPendingValue] = useState<{
    text?: string;
    numeric?: number | null;
    boolean?: boolean | null;
  }>({});
  const [isPending, setIsPending] = useState(false);

  // Property defs not yet set on this item
  const setDefIds = new Set(properties.map((p) => p.propertyDefId));
  const availableDefs = allPropertyDefs.filter((d) => !setDefIds.has(d.id));
  const selectedDef = allPropertyDefs.find((d) => d.id === selectedDefId);

  function resetAddDialog() {
    setSelectedDefId("");
    setPendingValue({});
    setAddOpen(false);
  }

  async function handleAdd() {
    if (!selectedDef) return;
    setIsPending(true);
    try {
      const result = await upsertItemProperty(inventoryItemId, selectedDefId, pendingValue);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: String(result.error) });
        return;
      }
      toast({ title: "Property saved" });
      resetAddDialog();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleInlineUpdate(
    prop: ItemProperty,
    value: { text?: string; numeric?: number | null; boolean?: boolean | null }
  ) {
    await upsertItemProperty(inventoryItemId, prop.propertyDefId, value);
    router.refresh();
  }

  async function handleDelete(prop: ItemProperty) {
    const result = await deleteItemProperty(inventoryItemId, prop.propertyDefId);
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: String(result.error) });
      return;
    }
    toast({ title: "Property removed" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setAddOpen(true)} disabled={availableDefs.length === 0}>
          <Plus className="h-4 w-4 mr-1" />
          Add property
        </Button>
      </div>

      {properties.length === 0 && (
        <div className="rounded-lg border bg-white p-6 text-center text-muted-foreground text-sm">
          <SlidersHorizontal className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          No properties set on this item.
          {allPropertyDefs.length === 0 && (
            <p className="mt-1 text-xs">
              Define property types in <strong>Settings → Item Properties</strong> first.
            </p>
          )}
        </div>
      )}

      {properties.length > 0 && (
        <div className="rounded-md border bg-white divide-y">
          {properties.map((prop) => {
            const def = prop.propertyDef;
            return (
              <div key={prop.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-48 flex-shrink-0">
                  <p className="text-sm font-medium">{def.name}</p>
                  {def.unit && (
                    <p className="text-xs text-muted-foreground">{def.unit}</p>
                  )}
                </div>
                <Badge variant="outline" className={`text-xs flex-shrink-0 ${typeBadge[def.valueType]}`}>
                  {typeLabel[def.valueType]}
                </Badge>
                <div className="flex-1">
                  {def.valueType === "BOOLEAN" && (
                    <Switch
                      checked={prop.booleanValue ?? false}
                      onCheckedChange={(v) => handleInlineUpdate(prop, { boolean: v })}
                    />
                  )}
                  {def.valueType === "NUMERIC" && (
                    <Input
                      type="number"
                      defaultValue={prop.numericValue?.toString() ?? ""}
                      className="h-8 w-40 text-sm"
                      onBlur={(e) =>
                        handleInlineUpdate(prop, {
                          numeric: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  )}
                  {def.valueType === "TEXT" && (
                    <Input
                      defaultValue={prop.textValue ?? ""}
                      className="h-8 text-sm"
                      onBlur={(e) => handleInlineUpdate(prop, { text: e.target.value })}
                    />
                  )}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="flex-shrink-0">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove property?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Remove &quot;{def.name}&quot; from this item.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(prop)}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}
        </div>
      )}

      {/* Add property dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) resetAddDialog(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add property</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Property</label>
              <Select onValueChange={(v) => { setSelectedDefId(v); setPendingValue({}); }} value={selectedDefId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {availableDefs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                      {d.unit && <span className="text-muted-foreground ml-1">({d.unit})</span>}
                      <Badge variant="outline" className={`ml-2 text-[10px] ${typeBadge[d.valueType]}`}>
                        {typeLabel[d.valueType]}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDef && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Value{selectedDef.unit ? ` (${selectedDef.unit})` : ""}
                </label>
                {selectedDef.valueType === "BOOLEAN" && (
                  <Switch
                    checked={pendingValue.boolean ?? false}
                    onCheckedChange={(v) => setPendingValue({ boolean: v })}
                  />
                )}
                {selectedDef.valueType === "NUMERIC" && (
                  <Input
                    type="number"
                    value={pendingValue.numeric?.toString() ?? ""}
                    onChange={(e) =>
                      setPendingValue({
                        numeric: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                )}
                {selectedDef.valueType === "TEXT" && (
                  <Input
                    value={pendingValue.text ?? ""}
                    onChange={(e) => setPendingValue({ text: e.target.value })}
                  />
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAddDialog}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!selectedDefId || isPending}>
              {isPending ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
