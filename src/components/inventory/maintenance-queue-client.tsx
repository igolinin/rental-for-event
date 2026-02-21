"use client";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateMaintenanceLogStatus } from "@/server/actions/inventory";
import { toast } from "@/hooks/use-toast";
import { MoreHorizontal } from "lucide-react";
import type { MaintenanceLogEntry } from "@/server/queries/inventory";
import { formatDate } from "@/lib/utils";

const maintenanceStatusBadge: Record<string, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-red-50 text-red-700 border-red-200" },
  IN_PROGRESS: { label: "In progress", className: "bg-amber-50 text-amber-700 border-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-green-50 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

function formatCents(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

interface MaintenanceQueueClientProps {
  logs: MaintenanceLogEntry[];
}

export function MaintenanceQueueClient({ logs }: MaintenanceQueueClientProps) {
  const router = useRouter();

  async function handleStatus(
    logId: string,
    status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  ) {
    const result = await updateMaintenanceLogStatus(logId, status);
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: String(result.error) });
    } else {
      toast({ title: "Status updated" });
      router.refresh();
    }
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <p className="text-muted-foreground text-sm">
          No open maintenance tasks. All equipment is in good shape.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reported</TableHead>
            <TableHead>Vendor / Tech</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const badge = maintenanceStatusBadge[log.status];
            return (
              <TableRow key={log.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/inventory/${log.inventoryItemId}`}
                    className="font-medium text-slate-900 hover:underline text-sm"
                  >
                    {log.inventoryItem.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {log.inventoryItem.category.name}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {log.serializedUnit?.serialNumber ?? "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {log.type.replace(/_/g, " ")}
                </TableCell>
                <TableCell className="text-sm max-w-[200px] truncate">
                  {log.description}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={badge.className}>
                    {badge.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(log.reportedAt)}
                </TableCell>
                <TableCell className="text-sm">
                  {log.vendor ?? log.technicianName ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {formatCents(log.costAmount, log.costCurrency)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {log.status === "OPEN" && (
                        <DropdownMenuItem
                          onClick={() => handleStatus(log.id, "IN_PROGRESS")}
                        >
                          Mark in progress
                        </DropdownMenuItem>
                      )}
                      {(log.status === "OPEN" || log.status === "IN_PROGRESS") && (
                        <DropdownMenuItem
                          onClick={() => handleStatus(log.id, "COMPLETED")}
                        >
                          Mark completed
                        </DropdownMenuItem>
                      )}
                      {(log.status === "OPEN" || log.status === "IN_PROGRESS") && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleStatus(log.id, "CANCELLED")}
                        >
                          Cancel
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
