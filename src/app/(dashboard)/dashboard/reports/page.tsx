import { Metadata } from "next";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getRevenueReport,
  getInventoryUtilizationReport,
  getLaborReport,
} from "@/server/queries/reports";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

interface PageProps {
  searchParams: Promise<{
    report?: string;
    from?: string;
    to?: string;
  }>;
}

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function defaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const report = params.report ?? "revenue";
  const defaults = defaultDateRange();
  const from = params.from ?? defaults.from;
  const to = params.to ?? defaults.to;

  const REPORTS = [
    { id: "revenue", label: "Revenue" },
    { id: "utilization", label: "Utilization" },
    { id: "labor", label: "Labor" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Reports</h1>

      {/* Report selector */}
      <div className="flex gap-2 mb-6">
        {REPORTS.map((r) => (
          <Link
            key={r.id}
            href={`/dashboard/reports?report=${r.id}&from=${from}&to=${to}`}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              report === r.id
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {/* Date range filter */}
      <form method="GET" className="flex flex-wrap items-end gap-3 mb-6">
        <input type="hidden" name="report" value={report} />
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-3 h-9 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          Apply
        </button>
        <Link
          href={`/dashboard/reports/print?type=${report}&from=${from}&to=${to}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 justify-center rounded-md border border-input bg-transparent px-3 h-9 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground ml-auto"
        >
          <FileDown className="h-4 w-4" />
          Export PDF
        </Link>
      </form>

      {/* Revenue report */}
      {report === "revenue" && (
        <RevenueReportView from={from} to={to} />
      )}

      {/* Utilization report */}
      {report === "utilization" && (
        <UtilizationReportView from={from} to={to} />
      )}

      {/* Labor report */}
      {report === "labor" && (
        <LaborReportView from={from} to={to} />
      )}
    </div>
  );
}

async function RevenueReportView({ from, to }: { from: string; to: string }) {
  const { invoices, totalRevenue, totalPaid, totalBalance, byClient } =
    await getRevenueReport({ fromDate: from, toDate: to });

  const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-600 border-slate-200" },
    SENT: { label: "Sent", className: "bg-blue-50 text-blue-700 border-blue-200" },
    PARTIALLY_PAID: { label: "Partial", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    PAID: { label: "Paid", className: "bg-green-50 text-green-700 border-green-200" },
    OVERDUE: { label: "Overdue", className: "bg-red-50 text-red-600 border-red-200" },
    VOID: { label: "Void", className: "bg-slate-100 text-slate-400 border-slate-200" },
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total invoiced", value: formatCents(totalRevenue), color: "text-slate-900" },
          { label: "Collected", value: formatCents(totalPaid), color: "text-green-700" },
          { label: "Outstanding", value: formatCents(totalBalance), color: totalBalance > 0 ? "text-red-600" : "text-slate-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border bg-white p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* By client */}
      {byClient.length > 0 && (
        <div>
          <h2 className="font-semibold text-sm mb-2">By client</h2>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byClient.map((row) => (
                  <TableRow key={row.clientName}>
                    <TableCell className="font-medium text-sm">{row.clientName}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{formatCents(row.total)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-green-700">{formatCents(row.paid)}</TableCell>
                    <TableCell className={`text-right tabular-nums text-sm ${row.total - row.paid > 0 ? "text-destructive" : "text-slate-500"}`}>
                      {formatCents(row.total - row.paid)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Invoice list */}
      <div>
        <h2 className="font-semibold text-sm mb-2">All invoices ({invoices.length})</h2>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-16 text-center text-muted-foreground">
                    No invoices in this period.
                  </TableCell>
                </TableRow>
              )}
              {invoices.map((inv) => {
                const badge = STATUS_BADGE[inv.status];
                const balance = inv.totalAmount - inv.paidAmount;
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/dashboard/invoices/${inv.id}`} className="font-medium hover:underline text-sm">
                        {inv.refCode}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{inv.client.name}</TableCell>
                    <TableCell className="text-sm">{inv.project.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={badge?.className}>{badge?.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(inv.issueDate)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{formatCents(inv.totalAmount, inv.currencyCode)}</TableCell>
                    <TableCell className={`text-right tabular-nums text-sm ${balance > 0 ? "text-destructive" : "text-slate-500"}`}>
                      {formatCents(balance, inv.currencyCode)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

async function UtilizationReportView({ from, to }: { from: string; to: string }) {
  const rows = await getInventoryUtilizationReport({ fromDate: from, toDate: to });

  return (
    <div>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Total qty</TableHead>
              <TableHead className="text-right">Booked unit-days</TableHead>
              <TableHead className="text-right">Utilization</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                  No inventory data.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/dashboard/inventory/${row.id}`} className="font-medium hover:underline text-sm">
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.categoryName}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{row.totalQuantity}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{row.bookedDays}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-20 bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${row.utilizationPct >= 80 ? "bg-red-500" : row.utilizationPct >= 50 ? "bg-amber-500" : "bg-green-500"}`}
                        style={{ width: `${row.utilizationPct}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-sm font-medium w-10 text-right">
                      {row.utilizationPct}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

async function LaborReportView({ from, to }: { from: string; to: string }) {
  const { timesheets, totalLabor, totalRegularHours, totalOvertimeHours, byCrew } =
    await getLaborReport({ fromDate: from, toDate: to });

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total labor cost", value: formatCents(totalLabor) },
          { label: "Regular hours", value: totalRegularHours.toFixed(1) + "h" },
          { label: "Overtime hours", value: totalOvertimeHours.toFixed(1) + "h" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-white p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* By crew member */}
      {byCrew.length > 0 && (
        <div>
          <h2 className="font-semibold text-sm mb-2">By crew member</h2>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Crew member</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                  <TableHead className="text-right">Regular hrs</TableHead>
                  <TableHead className="text-right">OT hrs</TableHead>
                  <TableHead className="text-right">Total cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCrew.map((row) => (
                  <TableRow key={row.crewMemberId}>
                    <TableCell>
                      <Link href={`/dashboard/crew/${row.crewMemberId}`} className="font-medium hover:underline text-sm">
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.type}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{row.entries}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{row.regularHours.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{row.overtimeHours.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">{formatCents(row.totalAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Timesheet list */}
      <div>
        <h2 className="font-semibold text-sm mb-2">Approved timesheets ({timesheets.length})</h2>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Crew member</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Reg hrs</TableHead>
                <TableHead className="text-right">OT hrs</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timesheets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-16 text-center text-muted-foreground">
                    No approved timesheets in this period.
                  </TableCell>
                </TableRow>
              )}
              {timesheets.map((ts) => (
                <TableRow key={ts.id}>
                  <TableCell className="font-medium text-sm">
                    {ts.crewMember.firstName} {ts.crewMember.lastName}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link href={`/dashboard/projects/${ts.project.id}`} className="hover:underline">
                      {ts.project.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(ts.clockIn)}</TableCell>
                  <TableCell className="text-sm">{ts.timeType}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{Number(ts.regularHours ?? 0).toFixed(1)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {(Number(ts.overtimeHours ?? 0) + Number(ts.doubleTimeHours ?? 0)).toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {ts.totalAmount != null ? formatCents(ts.totalAmount, ts.currency ?? "USD") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
