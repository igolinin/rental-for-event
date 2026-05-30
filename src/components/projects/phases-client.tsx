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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Users } from "lucide-react";
import {
  projectPhaseSchema, PHASE_TYPES, PHASE_LABELS, phaseDisplayName,
  type ProjectPhaseFormValues,
} from "@/schemas/phases";
import { createProjectPhase, deleteProjectPhase } from "@/server/actions/phases";
import { toast } from "@/hooks/use-toast";
import type { ProjectDetail } from "@/server/queries/projects";
import type { CrewForSelectEntry } from "@/server/queries/crew";
import { formatDate } from "@/lib/utils";

type Phase = NonNullable<ProjectDetail>["phases"][number];

function formatCents(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(cents / 100);
}

interface PhasesClientProps {
  projectId: string;
  phases: Phase[];
  crewForSelect: CrewForSelectEntry[];
  projectStartAt: string;
  projectEndAt: string;
  projectCurrency: string;
}

export function PhasesClient({
  projectId,
  phases,
  projectStartAt,
  projectEndAt,
}: PhasesClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const form = useForm<ProjectPhaseFormValues>({
    resolver: zodResolver(projectPhaseSchema),
    defaultValues: {
      name: "SETUP",
      customLabel: "",
      startAt: projectStartAt,
      endAt: projectEndAt,
      notes: "",
    },
  });

  const watchedName = form.watch("name");

  async function onSubmit(values: ProjectPhaseFormValues) {
    setIsPending(true);
    try {
      const result = await createProjectPhase(projectId, values);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error creating phase" });
        return;
      }
      toast({ title: "Phase added" });
      setDialogOpen(false);
      form.reset({ name: "SETUP", startAt: projectStartAt, endAt: projectEndAt });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(phaseId: string) {
    const result = await deleteProjectPhase(phaseId, projectId);
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: typeof result.error === "string" ? result.error : "Error deleting phase" });
      return;
    }
    toast({ title: "Phase deleted" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add phase
        </Button>
      </div>

      {phases.length === 0 && (
        <div className="rounded-lg border bg-white p-6 text-center text-muted-foreground text-sm">
          No phases scheduled. Add phases like Packing, Load-in, Setup, and Show.
        </div>
      )}

      {phases.length > 0 && (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phase</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Crew assigned</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {phases.map((phase) => (
                <TableRow key={phase.id}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-medium">
                      {phaseDisplayName(phase.name, phase.customLabel)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(phase.startAt)}</TableCell>
                  <TableCell className="text-sm">{formatDate(phase.endAt)}</TableCell>
                  <TableCell>
                    {phase.crewAssignments.length > 0 ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {phase.crewAssignments.length}
                        <span className="hidden sm:inline ml-1 text-xs">
                          {phase.crewAssignments.slice(0, 2).map(a =>
                            `${a.crewMember.firstName} ${a.crewMember.lastName}`
                          ).join(", ")}
                          {phase.crewAssignments.length > 2 && ` +${phase.crewAssignments.length - 2}`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {phase.notes ?? "—"}
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
                          <AlertDialogTitle>Delete phase?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Crew assignments linked to this phase will be unlinked (not deleted).
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(phase.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add phase</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phase type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {PHASE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{PHASE_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedName === "CUSTOM" && (
                <FormField
                  control={form.control}
                  name="customLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phase name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Rehearsal, Pre-show, Soundcheck" value={field.value ?? ""} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start *</FormLabel>
                      <FormControl><Input type="datetime-local" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End *</FormLabel>
                      <FormControl><Input type="datetime-local" {...field} /></FormControl>
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
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>{isPending ? "Adding…" : "Add phase"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
