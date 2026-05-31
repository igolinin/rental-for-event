"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inventoryItemSchema, type InventoryItemFormValues } from "@/schemas/inventory";
import { createInventoryItem, updateInventoryItem } from "@/server/actions/inventory";
import type { CategoryWithSubs } from "@/server/queries/inventory";
import { toast } from "@/hooks/use-toast";
import { AiFillDialog } from "@/components/inventory/ai-fill-dialog";
import type { ItemSuggestion } from "@/lib/ai";

interface ItemFormProps {
  categories: CategoryWithSubs[];
  defaultValues?: Partial<InventoryItemFormValues>;
  itemId?: string;
  aiProviderLabel?: string | null;
  pricingProfiles?: { id: string; name: string; isDefault: boolean }[];
}

export function ItemForm({ categories, defaultValues, itemId, aiProviderLabel, pricingProfiles = [] }: ItemFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const form = useForm<InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      name: "",
      description: "",
      categoryId: "",
      subCategoryId: "",
      trackingMode: "BULK",
      totalQuantity: 0,
      dailyRateAmount: undefined,
      dailyRateCurrency: "USD",
      replacementCostAmount: undefined,
      replacementCostCurrency: "USD",
      pricingProfileId: "",
      noDiscount: false,
      notes: "",
      isActive: true,
      ...defaultValues,
    },
  });

  const watchedCategory = form.watch("categoryId");
  const watchedTracking = form.watch("trackingMode");

  const selectedCategory = categories.find((c) => c.id === watchedCategory);

  // Reset sub-category when category changes
  useEffect(() => {
    if (!defaultValues?.categoryId || defaultValues.categoryId !== watchedCategory) {
      form.setValue("subCategoryId", "");
    }
  }, [watchedCategory, defaultValues?.categoryId, form]);

  function applyAiSuggestion(s: ItemSuggestion) {
    if (s.name) form.setValue("name", s.name);
    if (s.description) form.setValue("description", s.description);
    if (s.dailyRateHintCents != null) form.setValue("dailyRateAmount", s.dailyRateHintCents);
    if (s.replacementCostHintCents != null) form.setValue("replacementCostAmount", s.replacementCostHintCents);
    // Match category by name hint (case-insensitive contains)
    if (s.categoryHint) {
      const match = categories.find(
        (c) => c.name.toLowerCase() === s.categoryHint.toLowerCase() ||
               c.name.toLowerCase().includes(s.categoryHint.toLowerCase()) ||
               s.categoryHint.toLowerCase().includes(c.name.toLowerCase())
      );
      if (match) form.setValue("categoryId", match.id);
    }
    // Append suggested specs to notes so they're not lost (properties UI lives on detail page)
    if (s.properties.length > 0) {
      const specLines = s.properties.map((p) => `${p.name}: ${p.value}`).join("\n");
      const existing = form.getValues("notes");
      form.setValue("notes", existing ? `${existing}\n\nAI-suggested specs:\n${specLines}` : `AI-suggested specs:\n${specLines}`);
    }
  }

  async function onSubmit(values: InventoryItemFormValues) {
    setIsPending(true);
    try {
      const result = itemId
        ? await updateInventoryItem(itemId, values)
        : await createInventoryItem(values);

      if ("error" in result && result.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Please fix the form errors.",
        });
        return;
      }

      toast({ title: itemId ? "Item updated" : "Item created" });

      if (!itemId && "id" in result && result.id) {
        router.push(`/dashboard/inventory/${result.id}`);
      } else {
        router.push("/dashboard/inventory");
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {aiProviderLabel && !itemId && (
          <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50/50 px-4 py-3">
            <p className="text-sm text-slate-600">
              Have a photo? Let AI pre-fill the details for you.
            </p>
            <AiFillDialog providerLabel={aiProviderLabel} onFilled={applyAiSuggestion} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Shure SM58 Dynamic Microphone" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category */}
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Sub-category */}
          <FormField
            control={form.control}
            name="subCategoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sub-category</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                  value={field.value || "__none__"}
                  disabled={!selectedCategory?.subCategories.length}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sub-category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {selectedCategory?.subCategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tracking mode */}
          <FormField
            control={form.control}
            name="trackingMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tracking mode *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="SERIALIZED">Serialized (individual units)</SelectItem>
                    <SelectItem value="BULK">Bulk (quantity pool)</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Use Serialized for high-value items tracked by serial number.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Total quantity — only for BULK */}
          {watchedTracking === "BULK" && (
            <FormField
              control={form.control}
              name="totalQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total quantity *</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Daily rate */}
          <FormField
            control={form.control}
            name="dailyRateAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Daily rate (cents)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 5000 = $50.00"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                </FormControl>
                <FormDescription>Enter in smallest currency unit (cents).</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Replacement cost */}
          <FormField
            control={form.control}
            name="replacementCostAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Replacement cost (cents)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 30000 = $300.00"
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

          {/* Pricing profile */}
          <FormField
            control={form.control}
            name="pricingProfileId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pricing curve</FormLabel>
                <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Use system default" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Use system default</SelectItem>
                    {pricingProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.isDefault ? " (default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Duration-based rate card applied when this item is rented.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* No-discount lock */}
          <FormField
            control={form.control}
            name="noDiscount"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start gap-3 rounded-md border p-4 sm:col-span-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-0.5 leading-none">
                  <FormLabel>No discount (locked)</FormLabel>
                  <FormDescription>
                    Exempt this item from all discounts (item, category, or project). Use for consumables.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Optional technical description or specifications"
                    rows={3}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Internal notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Internal notes visible to staff only"
                    rows={2}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : itemId ? "Save changes" : "Create item"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
