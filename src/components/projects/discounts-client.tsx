"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Percent } from "lucide-react";
import { setProjectDiscount, setCategoryDiscount } from "@/server/actions/projects";
import { toast } from "@/hooks/use-toast";
import type { DiscountSpec } from "@/lib/discounts";

type Mode = "NONE" | "PERCENT" | "FIXED";

function specToMode(spec: DiscountSpec | null): { mode: Mode; value: string } {
  if (!spec) return { mode: "NONE", value: "" };
  if (spec.percent) return { mode: "PERCENT", value: String(Math.round(spec.percent * 100)) };
  if (spec.fixed) return { mode: "FIXED", value: String(spec.fixed) };
  return { mode: "NONE", value: "" };
}

interface DiscountRowProps {
  label: string;
  spec: DiscountSpec | null;
  onSave: (percent: number | null, fixed: number | null) => Promise<void>;
}

function DiscountRow({ label, spec, onSave }: DiscountRowProps) {
  const init = specToMode(spec);
  const [mode, setMode] = useState<Mode>(init.mode);
  const [value, setValue] = useState(init.value);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      if (mode === "NONE" || value === "") {
        await onSave(null, null);
      } else if (mode === "PERCENT") {
        await onSave(Number(value) / 100, null);
      } else {
        await onSave(null, Number(value));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-40 text-sm">{label}</span>
      <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="NONE">No discount</SelectItem>
          <SelectItem value="PERCENT">Percent</SelectItem>
          <SelectItem value="FIXED">Fixed (cents)</SelectItem>
        </SelectContent>
      </Select>
      {mode !== "NONE" && (
        <Input
          type="number" min={0}
          className="h-8 w-28"
          placeholder={mode === "PERCENT" ? "15" : "5000"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
        {saving ? "…" : "Save"}
      </Button>
    </div>
  );
}

interface DiscountsClientProps {
  projectId: string;
  projectDiscount: DiscountSpec | null;
  categoryDiscounts: Record<string, DiscountSpec>;
  kitCategories: { id: string; name: string }[];
}

export function DiscountsClient({
  projectId,
  projectDiscount,
  categoryDiscounts,
  kitCategories,
}: DiscountsClientProps) {
  const router = useRouter();

  async function saveProjectDiscount(percent: number | null, fixed: number | null) {
    const result = await setProjectDiscount(projectId, percent, fixed);
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: typeof result.error === "string" ? result.error : "Error saving discount" });
      return;
    }
    toast({ title: "Project discount updated" });
    router.refresh();
  }

  async function saveCategoryDiscount(categoryId: string, percent: number | null, fixed: number | null) {
    const result = await setCategoryDiscount(projectId, { categoryId, discountPercent: percent, discountFixed: fixed });
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: typeof result.error === "string" ? result.error : "Error saving discount" });
      return;
    }
    toast({ title: "Category discount updated" });
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-white p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Percent className="h-4 w-4 text-indigo-500" />
        <h3 className="font-semibold text-sm">Discounts</h3>
        <span className="text-xs text-muted-foreground">most-specific wins: line → category → project</span>
      </div>

      <div className="space-y-2">
        <DiscountRow
          label="Whole project"
          spec={projectDiscount}
          onSave={saveProjectDiscount}
        />
        {kitCategories.map((cat) => (
          <DiscountRow
            key={cat.id}
            label={cat.name}
            spec={categoryDiscounts[cat.id] ?? null}
            onSave={(p, f) => saveCategoryDiscount(cat.id, p, f)}
          />
        ))}
        {kitCategories.length === 0 && (
          <p className="text-xs text-muted-foreground">Add equipment to the kit list to set category discounts.</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Line-level discounts are set on each kit item. Items flagged &quot;no discount&quot; are never discounted.
      </p>
    </div>
  );
}
