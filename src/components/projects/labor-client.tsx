"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MoreHorizontal, Trash2 } from "lucide-react";
import { laborSubcontractSchema, type LaborSubcontractFormValues } from "@/schemas/labor";
import { createLaborSubcontract, updateLaborSubcontractStatus, deleteLaborSubcontract } from "@/server/actions/labor";
import { toast } from "@/hooks/use-toast";
import { phaseDisplayName } from "@/schemas/phases";
import type { ProjectDetail } from "@/server/queries/projects";
import { formatDate } from "@/lib/utils";

type LaborSubcontract = NonNullable<ProjectDetail>["laborSubcontracts"][number];
type Phase = NonNullable<ProjectDetail>["phases"][number];

const statusBadge: Record<string, { label: string; className: string }> = {
  REQUESTED: { label: "Requested", className: "bg-slate-100 text-slate-600 border-slate-200" },
  CONFIRMED: { label: "Confirmed", className: "bg-blue-50 text-blue-700 border-blue-200" },
  RECEIVED: { label: "On-site", className: "bg-green-50 text-green-700 border-green-200" },
  COMPLETED: { label: "Completed", className: "bg-purple-50 text-purple-700 border-purple-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-600 border-red-200" },
};

function formatCents(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(cents / 100);
}

function estimateDays(startAt: Date, endAt: Date) {
  return Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / 86400000) + 1);
}

interface LaborClientProps {
  projectId: string;
  laborSubcontracts: LaborSubcontract[];
  phases: Phase[];
  projectCurrency: string;
  projectStartAt: string;
  projectEndAt: string;
}

export function LaborClient({
  projectId,
  laborSubcontracts,
  phases,
  projectCurrency,
  projectStartAt,
  projectEndAt,
}: LaborClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const form = useForm<LaborSubcontractFormValues>({
    resolver: zodResolver(laborSubcontractSchema),
    defaultValues: {
      vendorName: "",
      vendorContact: "",
      vendorEmail: "",
      role: "",
      quantity: 1,
      startAt: projectStartAt,
      endAt: projectEndAt,
      dailyRateAmount: undefined,
      dailyRateCurrency: projectCurrency,
      status: "REQUESTED",
      notes: "",
    },
  });

  async function onSubmit(values: LaborSubcontractFormValues) {
    setIsPending(true);
    try {
      const result = await createLaborSubcontract(projectId, values);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error creating labor subcontract" });
        return;
      }
      toast({ title: "Labor subcontract created" });
      setDialogOpen(false);
      form.reset({ startAt: projectStartAt, endAt: projectEndAt, quantity: 1, status: "REQUESTED" });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleStatusChange(
    id: string,
    status: "REQUESTED" | "CONFIRMED" | "RECEIVED" | "COMPLETED" | "CANCELLED"
  ) {
    await updateLaborSubcontractStatus(id, projectId, status);
    toast({ title: "Status updated" });
    router.refresh();
  }

  async function handleDelete(id: string) {
    await deleteLaborSubcontract(id, projectId);
    toast({ title: "Labor subcontract removed" });
    router.refresh();
  }

  const totalCost = laborSubcontracts
    .filter((lsc) => lsc.status !== "CANCELLED")
    .reduce((sum, lsc) => {
      if (!lsc.dailyRateAmount) return sum;
      return sum + lsc.dailyRateAmount * lsc.quantity * estimateDays(lsc.startAt, lsc.endAt);
    }, 0);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add labor subcontract
        </Button>
      </div>

      {laborSubcontracts.length === 0 && (
        <div className="rounded-lg border bg-white p-6 text-center text-muted-foreground text-sm">
          No labor subcontracts. Add external stage hands or crew vendors here.
        </div>
      )}

      <div className="space-y-3">
        {laborSubcontracts.map((lsc) => {
          const badge = statusBadge[lsc.status];
          const days = estimateDays(lsc.startAt, lsc.endAt);
          const estimate = lsc.dailyRateAmount
            ? lsc.dailyRateAmount * lsc.quantity * days
            : null;

          return (
            <div key={lsc.id} className="rounded-lg border bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{lsc.vendorName}</span>
                    {lsc.role && (
                      <span className="text-xs text-muted-foreground">— {lsc.role}</span>
                    )}
                    <Badge variant="outline" className={`text-xs ${badge.className}`}>
                      {badge.label}
                    </Badge>
                    {lsc.phase && (
                      <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                        {phaseDisplayName(lsc.phase.name, lsc.phase.customLabel)}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
                    <span>{lsc.quantity} {lsc.quantity === 1 ? "person" : "people"}</span>
                    <span>{formatDate(lsc.startAt)} → {formatDate(lsc.endAt)} ({days}d)</span>
                    {lsc.dailyRateAmount && (
                      <span>
                        {formatCents(lsc.dailyRateAmount, lsc.dailyRateCurrency)}/day/person
                        {" · "}
                        <strong>{formatCents(estimate, lsc.dailyRateCurrency)} est.</strong>
                      </span>
                    )}
                    {lsc.vendorContact && <span>{lsc.vendorContact}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {lsc.status !== "CONFIRMED" && lsc.status !== "CANCELLED" && (
                        <DropdownMenuItem onClick={() => handleStatusChange(lsc.id, "CONFIRMED")}>
                          Mark confirmed
                        </DropdownMenuItem>
                      )}
                      {lsc.status !== "RECEIVED" && lsc.status !== "CANCELLED" && (
                        <DropdownMenuItem onClick={() => handleStatusChange(lsc.id, "RECEIVED")}>
                          Mark on-site
                        </DropdownMenuItem>
                      )}
                      {lsc.status !== "COMPLETED" && lsc.status !== "CANCELLED" && (
                        <DropdownMenuItem onClick={() => handleStatusChange(lsc.id, "COMPLETED")}>
                          Mark completed
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleStatusChange(lsc.id, "CANCELLED")}
                      >
                        Cancel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete labor subcontract?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Remove {lsc.vendorName} from this project.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(lsc.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {laborSubcontracts.length > 0 && totalCost > 0 && (
        <div className="mt-3 text-right text-sm font-semibold text-slate-700">
          Total labor subcontract cost: {formatCents(totalCost, projectCurrency)}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add labor subcontract</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="vendorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor / company name *</FormLabel>
                    <FormControl><Input placeholder="ABC Stagehands" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vendorContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact name</FormLabel>
                      <FormControl><Input value={field.value ?? ""} onChange={field.onChange} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vendorEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" value={field.value ?? ""} onChange={field.onChange} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role / type</FormLabel>
                      <FormControl><Input placeholder="Stagehands, Riggers, Loaders…" value={field.value ?? ""} onChange={field.onChange} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of people *</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From *</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To *</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dailyRateAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Daily rate (cents/person)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="e.g. 15000 = $150"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {phases.length > 0 && (
                  <FormField
                    control={form.control}
                    name="phaseId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phase (optional)</FormLabel>
                        <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                          <FormControl><SelectTrigger><SelectValue placeholder="No specific phase" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">No specific phase</SelectItem>
                            {phases.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {phaseDisplayName(p.name, p.customLabel)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
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
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>{isPending ? "Creating…" : "Create"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
