"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KitListClient } from "@/components/projects/kit-list-client";
import { SubRentalsClient } from "@/components/projects/sub-rentals-client";
import { ExpensesClient } from "@/components/projects/expenses-client";
import { updateProjectStatus } from "@/server/actions/projects";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, Pencil, ChevronDown } from "lucide-react";
import type { ProjectDetail, ProjectPnL } from "@/server/queries/projects";
import type { ItemListEntry } from "@/server/queries/inventory";
import { formatDate } from "@/lib/utils";

const projectStatusBadge: Record<string, { label: string; className: string }> = {
  INQUIRY: { label: "Inquiry", className: "bg-slate-100 text-slate-600 border-slate-200" },
  QUOTED: { label: "Quoted", className: "bg-blue-50 text-blue-700 border-blue-200" },
  CONFIRMED: { label: "Confirmed", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  IN_PROGRESS: { label: "In progress", className: "bg-amber-50 text-amber-700 border-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-green-50 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-600 border-red-200" },
};

const STATUS_FLOW = [
  "INQUIRY", "QUOTED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED",
] as const;

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

interface ProjectDetailClientProps {
  project: NonNullable<ProjectDetail>;
  pnl: ProjectPnL;
  inventoryItems: ItemListEntry[];
}

export function ProjectDetailClient({
  project,
  pnl,
  inventoryItems,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const badge = projectStatusBadge[project.status];

  async function handleStatusChange(
    status: (typeof STATUS_FLOW)[number]
  ) {
    await updateProjectStatus(project.id, status);
    toast({ title: `Status updated to ${status.replace(/_/g, " ")}` });
    router.refresh();
  }

  const projectStartStr = new Date(project.startAt).toISOString().slice(0, 10);
  const projectEndStr = new Date(project.endAt).toISOString().slice(0, 10);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/projects">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">
                {project.refCode}
              </span>
              <Badge variant="outline" className={badge.className}>
                {badge.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {project.type.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Status changer */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Change status
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_FLOW.filter((s) => s !== project.status).map((s) => (
                <DropdownMenuItem key={s} onClick={() => handleStatusChange(s)}>
                  {s.replace(/_/g, " ")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/projects/${project.id}/edit`}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Client", value: project.client.name },
          {
            label: "Dates",
            value: `${formatDate(project.startAt)} → ${formatDate(project.endAt)}`,
          },
          { label: "Venue", value: project.venue ?? "—" },
          { label: "Currency", value: project.currencyCode },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-white p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {s.label}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="kit">
            Kit list ({project.equipmentItems.length})
          </TabsTrigger>
          <TabsTrigger value="subrentals">
            Sub-rentals ({project.subRentals.length})
          </TabsTrigger>
          <TabsTrigger value="expenses">
            Expenses ({project.expenses.length})
          </TabsTrigger>
          <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4">
          <div className="max-w-xl rounded-lg border bg-white p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {project.loadInAt && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Load-in</p>
                  <p>{formatDate(project.loadInAt)}</p>
                </div>
              )}
              {project.loadOutAt && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Load-out</p>
                  <p>{formatDate(project.loadOutAt)}</p>
                </div>
              )}
              {project.city && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">City</p>
                  <p>{project.city}{project.country ? `, ${project.country}` : ""}</p>
                </div>
              )}
              {project.depositAmount && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Deposit</p>
                  <p>{formatCents(project.depositAmount, project.currencyCode)}</p>
                </div>
              )}
              {project.taxRate && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Tax rate</p>
                  <p>{(Number(project.taxRate) * 100).toFixed(1)}%</p>
                </div>
              )}
            </div>
            {project.notes && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Client notes
                </p>
                <p className="text-sm">{project.notes}</p>
              </div>
            )}
            {project.internalNotes && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Internal notes
                </p>
                <p className="text-sm text-muted-foreground">{project.internalNotes}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Created by
              </p>
              <p className="text-sm">{project.createdBy.name}</p>
            </div>
          </div>
        </TabsContent>

        {/* Kit list */}
        <TabsContent value="kit" className="mt-4">
          <KitListClient
            projectId={project.id}
            equipmentItems={project.equipmentItems}
            inventoryItems={inventoryItems}
            projectCurrency={project.currencyCode}
          />
        </TabsContent>

        {/* Sub-rentals */}
        <TabsContent value="subrentals" className="mt-4">
          <SubRentalsClient
            projectId={project.id}
            subRentals={project.subRentals}
            projectCurrency={project.currencyCode}
            projectStartAt={projectStartStr}
            projectEndAt={projectEndStr}
          />
        </TabsContent>

        {/* Expenses */}
        <TabsContent value="expenses" className="mt-4">
          <ExpensesClient
            projectId={project.id}
            expenses={project.expenses}
            projectCurrency={project.currencyCode}
          />
        </TabsContent>

        {/* P&L */}
        <TabsContent value="pnl" className="mt-4">
          <div className="max-w-md space-y-3">
            {[
              {
                label: "Equipment revenue",
                value: pnl.equipmentRevenue,
                positive: true,
              },
              {
                label: "Sub-rental costs",
                value: -pnl.subRentalCosts,
                positive: false,
              },
              {
                label: "Project expenses",
                value: -pnl.expenseTotal,
                positive: false,
              },
              {
                label: "Labour costs (approved)",
                value: -pnl.laborCosts,
                positive: false,
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-lg border bg-white px-4 py-3"
              >
                <span className="text-sm text-slate-700">{row.label}</span>
                <span
                  className={`tabular-nums font-medium text-sm ${
                    row.value >= 0 ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {formatCents(Math.abs(row.value), project.currencyCode)}
                  {row.value < 0 ? " ↓" : ""}
                </span>
              </div>
            ))}

            <div className="flex items-center justify-between rounded-lg border-2 border-slate-300 bg-white px-4 py-3">
              <span className="font-semibold text-slate-900">Gross margin</span>
              <span
                className={`tabular-nums font-bold text-lg ${
                  pnl.grossMargin >= 0 ? "text-green-700" : "text-red-600"
                }`}
              >
                {formatCents(pnl.grossMargin, project.currencyCode)}
                {" "}
                <span className="text-sm font-medium">
                  ({pnl.marginPct.toFixed(1)}%)
                </span>
              </span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
