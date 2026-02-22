"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  approveTimesheet,
  rejectTimesheet,
  submitTimesheet,
  deleteTimesheet,
} from "@/server/actions/crew";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import type { TimesheetEntry } from "@/server/queries/crew";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-600 border-slate-200" },
  SUBMITTED: { label: "Submitted", className: "bg-blue-50 text-blue-700 border-blue-200" },
  APPROVED: { label: "Approved", className: "bg-green-50 text-green-700 border-green-200" },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-600 border-red-200" },
};

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

interface TimesheetsClientProps {
  timesheets: TimesheetEntry[];
}

export function TimesheetsClient({ timesheets }: TimesheetsClientProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function handleAction(
    id: string,
    action: "submit" | "approve" | "reject" | "delete"
  ) {
    setPending(id);
    try {
      let result;
      if (action === "submit") result = await submitTimesheet(id);
      else if (action === "approve") result = await approveTimesheet(id);
      else if (action === "reject") result = await rejectTimesheet(id);
      else result = await deleteTimesheet(id);

      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: String(result.error) });
        return;
      }

      const labels = {
        submit: "Timesheet submitted",
        approve: "Timesheet approved",
        reject: "Timesheet rejected",
        delete: "Timesheet deleted",
      };
      toast({ title: labels[action] });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (timesheets.length === 0) {
    return (
      <div className="rounded-md border bg-white h-24 flex items-center justify-center text-sm text-muted-foreground">
        No timesheets found.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Crew member</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Clock-in</TableHead>
            <TableHead>Clock-out</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {timesheets.map((ts) => {
            const badge = STATUS_BADGE[ts.status];
            const isLoading = pending === ts.id;
            return (
              <TableRow key={ts.id}>
                <TableCell className="text-sm font-medium">
                  <Link
                    href={`/dashboard/crew/${ts.crewMember.id}`}
                    className="hover:underline text-slate-900"
                  >
                    {ts.crewMember.firstName} {ts.crewMember.lastName}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  <Link
                    href={`/dashboard/projects/${ts.project.id}`}
                    className="hover:underline text-slate-900"
                  >
                    {ts.project.name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{formatDate(ts.clockIn)}</TableCell>
                <TableCell className="text-sm">
                  {ts.clockOut ? formatDate(ts.clockOut) : "—"}
                </TableCell>
                <TableCell className="text-sm">{ts.timeType}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={badge.className}>
                    {badge.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {ts.totalAmount != null
                    ? formatCents(ts.totalAmount, ts.currency ?? "USD")
                    : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    {ts.status === "DRAFT" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isLoading}
                        onClick={() => handleAction(ts.id, "submit")}
                      >
                        Submit
                      </Button>
                    )}
                    {ts.status === "SUBMITTED" && (
                      <>
                        <Button
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleAction(ts.id, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isLoading}
                          onClick={() => handleAction(ts.id, "reject")}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {ts.status !== "APPROVED" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" disabled={isLoading}>
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete timesheet?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleAction(ts.id, "delete")}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
