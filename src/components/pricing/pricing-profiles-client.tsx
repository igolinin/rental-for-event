"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Star, Percent } from "lucide-react";
import { createPricingProfile, updatePricingProfile, deletePricingProfile, setDefaultProfile } from "@/server/actions/pricing";
import { effectivePerDay, type PricingTierLite } from "@/lib/pricing";
import { toast } from "@/hooks/use-toast";

interface ProfileView {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isSystem: boolean;
  usageCount: number;
  tiers: PricingTierLite[];
}

interface PricingProfilesClientProps {
  profiles: ProfileView[];
  canManage: boolean;
}

// Sample daily rate for the preview column ($100.00)
const SAMPLE = 10000;

export function PricingProfilesClient({ profiles, canManage }: PricingProfilesClientProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<ProfileView | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tiers, setTiers] = useState<PricingTierLite[]>([{ minDays: 1, multiplier: 1 }]);
  const [isPending, setIsPending] = useState(false);

  function openCreate() {
    setName(""); setDescription("");
    setTiers([{ minDays: 1, multiplier: 1 }, { minDays: 7, multiplier: 3 }, { minDays: 30, multiplier: 9 }]);
    setCreating(true);
  }

  function openEdit(p: ProfileView) {
    setName(p.name); setDescription(p.description ?? "");
    setTiers(p.tiers.length ? [...p.tiers] : [{ minDays: 1, multiplier: 1 }]);
    setEditing(p);
  }

  function closeDialog() {
    setCreating(false); setEditing(null);
  }

  function updateTier(idx: number, field: "minDays" | "multiplier", value: number) {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  }
  function addTier() {
    const maxDays = Math.max(0, ...tiers.map((t) => t.minDays));
    setTiers((prev) => [...prev, { minDays: maxDays + 7, multiplier: 1 }]);
  }
  function removeTier(idx: number) {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setIsPending(true);
    try {
      const sorted = [...tiers].sort((a, b) => a.minDays - b.minDays);
      const payload = { name, description, tiers: sorted };
      const result = editing
        ? await updatePricingProfile(editing.id, payload)
        : await createPricingProfile(payload);
      if ("error" in result && result.error) {
        const msg = typeof result.error === "string" ? result.error : "Check the form — a tier at 1 day is required and breakpoints must be unique.";
        toast({ variant: "destructive", title: msg });
        return;
      }
      toast({ title: editing ? "Profile updated" : "Profile created" });
      closeDialog();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(id: string) {
    const result = await deletePricingProfile(id);
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: String(result.error) });
      return;
    }
    toast({ title: "Profile deleted" });
    router.refresh();
  }

  async function handleSetDefault(id: string) {
    await setDefaultProfile(id);
    toast({ title: "Default profile updated" });
    router.refresh();
  }

  const sortedPreview = [...tiers].sort((a, b) => a.minDays - b.minDays);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pricing Profiles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Duration-based rate cards — longer rentals get a lower effective per-day price.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            New profile
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {profiles.map((p) => (
          <div key={p.id} className="rounded-lg border bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-indigo-500" />
                  <span className="font-semibold">{p.name}</span>
                  {p.isDefault && <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">Default</Badge>}
                  {p.isSystem && <Badge variant="outline" className="text-xs">Built-in</Badge>}
                  {p.usageCount > 0 && <span className="text-xs text-muted-foreground">· used by {p.usageCount}</span>}
                </div>
                {p.description && <p className="text-sm text-muted-foreground mt-1">{p.description}</p>}
              </div>
              {canManage && (
                <div className="flex gap-1">
                  {!p.isDefault && (
                    <Button variant="ghost" size="icon" title="Set as default" onClick={() => handleSetDefault(p.id)}>
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!p.isSystem && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={p.usageCount > 0}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete &quot;{p.name}&quot;?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(p.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}
            </div>

            {/* Curve preview */}
            <div className="mt-3 overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left pr-4 pb-1 font-medium">From day</th>
                    {p.tiers.map((t) => (
                      <th key={t.minDays} className="px-3 pb-1 text-right font-medium tabular-nums">{t.minDays}d</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-left pr-4 text-muted-foreground">Multiplier</td>
                    {p.tiers.map((t) => (
                      <td key={t.minDays} className="px-3 text-right tabular-nums">{t.multiplier}×</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="text-left pr-4 text-muted-foreground">Eff. /day ($100 base)</td>
                    {p.tiers.map((t) => (
                      <td key={t.minDays} className="px-3 text-right tabular-nums text-green-700">
                        ${(effectivePerDay(SAMPLE, t.minDays, p.tiers) / 100).toFixed(0)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={creating || !!editing} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit "${editing.name}"` : "New pricing profile"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Long-term rental" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Tiers (day breakpoint → multiplier)</label>
                <Button type="button" variant="outline" size="sm" onClick={addTier}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add tier
                </Button>
              </div>
              <div className="space-y-2">
                {sortedPreview.map((t) => {
                  const idx = tiers.findIndex((x) => x === t);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-14">from day</span>
                      <Input
                        type="number" min={1} className="h-8 w-20"
                        value={t.minDays}
                        onChange={(e) => updateTier(tiers.indexOf(t), "minDays", Number(e.target.value))}
                      />
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input
                        type="number" min={0} step={0.1} className="h-8 w-24"
                        value={t.multiplier}
                        onChange={(e) => updateTier(tiers.indexOf(t), "multiplier", Number(e.target.value))}
                      />
                      <span className="text-xs text-green-700 tabular-nums w-28">
                        = ${(effectivePerDay(SAMPLE, t.minDays, sortedPreview) / 100).toFixed(0)}/day eff.
                      </span>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeTier(tiers.indexOf(t))} disabled={t.minDays === 1}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                A tier starting at day 1 is required. Effective per-day shown for a $100 daily rate.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending || !name.trim()}>
              {isPending ? "Saving…" : editing ? "Save changes" : "Create profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
