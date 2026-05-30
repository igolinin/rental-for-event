"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { crewAssignmentSchema, type CrewAssignmentFormValues } from "@/schemas/crew";
import { createCrewAssignment, deleteCrewAssignment, checkCrewMemberConflict } from "@/server/actions/crew";
import { toast } from "@/hooks/use-toast";
import { phaseDisplayName } from "@/schemas/phases";
import type { ProjectDetail } from "@/server/queries/projects";
import type { CrewForSelectEntry } from "@/server/queries/crew";
import { formatDate } from "@/lib/utils";

type CrewAssignment = NonNullable<ProjectDetail>["crewAssignments"][number];
type Phase = NonNullable<ProjectDetail>["phases"][number];

interface CrewClientProps {
  projectId: string;
  crewAssignments: CrewAssignment[];
  phases: Phase[];
  crewForSelect: CrewForSelectEntry[];
  projectStartAt: string;
  projectEndAt: string;
}

export function CrewClient({
  projectId,
  crewAssignments,
  phases,
  crewForSelect,
  projectStartAt,
  projectEndAt,
}: CrewClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const conflictTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<CrewAssignmentFormValues>({
    resolver: zodResolver(crewAssignmentSchema),
    defaultValues: {
      crewMemberId: "",
      phaseId: "",
      role: "",
      startAt: projectStartAt,
      endAt: projectEndAt,
      notes: "",
    },
  });

  const watchedCrewId = form.watch("crewMemberId");
  const watchedStart = form.watch("startAt");
  const watchedEnd = form.watch("endAt");

  useEffect(() => {
    if (!watchedCrewId || !watchedStart || !watchedEnd) {
      setConflictWarning(null);
      return;
    }
    if (conflictTimeout.current) clearTimeout(conflictTimeout.current);
    conflictTimeout.current = setTimeout(async () => {
      const result = await checkCrewMemberConflict(
        watchedCrewId, watchedStart, watchedEnd, projectId
      );
      setConflictWarning(
        result.conflict
          ? `Already assigned to "${result.conflict.projectName}" during this period`
          : null
      );
    }, 400);
  }, [watchedCrewId, watchedStart, watchedEnd, projectId]);

  async function onSubmit(values: CrewAssignmentFormValues) {
    setIsPending(true);
    try {
      const result = await createCrewAssignment(projectId, values);
      if ("error" in result && result.error) {
        const msg = typeof result.error === "string" ? result.error : "Error adding crew member";
        toast({ variant: "destructive", title: msg });
        return;
      }
      toast({ title: "Crew member assigned" });
      setDialogOpen(false);
      form.reset({ crewMemberId: "", startAt: projectStartAt, endAt: projectEndAt });
      setConflictWarning(null);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(assignmentId: string) {
    const result = await deleteCrewAssignment(assignmentId, projectId);
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: String(result.error) });
      return;
    }
    toast({ title: "Assignment removed" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Assign crew member
        </Button>
      </div>

      {crewAssignments.length === 0 && (
        <div className="rounded-lg border bg-white p-6 text-center text-muted-foreground text-sm">
          No crew assigned to this project.
        </div>
      )}

      {crewAssignments.length > 0 && (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {crewAssignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/crew/${a.crewMember.id}`}
                      className="font-medium text-sm hover:underline"
                    >
                      {a.crewMember.firstName} {a.crewMember.lastName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{a.crewMember.type}</div>
                  </TableCell>
                  <TableCell className="text-sm">{a.role ?? "—"}</TableCell>
                  <TableCell>
                    {a.phase ? (
                      <Badge variant="outline" className="text-xs">
                        {phaseDisplayName(a.phase.name, a.phase.customLabel)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(a.startAt)}</TableCell>
                  <TableCell className="text-sm">{formatDate(a.endAt)}</TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove crew assignment?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {a.crewMember.firstName} {a.crewMember.lastName} will be removed from this project.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(a.id)}>Remove</AlertDialogAction>
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

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setConflictWarning(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign crew member</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="crewMemberId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Crew member *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select crew member" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {crewForSelect.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.firstName} {c.lastName}
                            {c.role ? ` — ${c.role}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {conflictWarning && (
                      <p className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-1">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                        {conflictWarning}
                      </p>
                    )}
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
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="No specific phase" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="">No specific phase</SelectItem>
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

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role on this project</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. FOH Engineer, Stage Manager" value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
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
                <Button type="submit" disabled={isPending}>{isPending ? "Assigning…" : "Assign"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
