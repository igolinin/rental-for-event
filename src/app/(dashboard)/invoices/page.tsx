import { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getInvoices } from "@/server/queries/invoices";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoices" };

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-600 border-slate-200" },
  SENT: { label: "Sent", className: "bg-blue-50 text-blue-700 border-blue-200" },
  PARTIALLY_PAID: { label: "Partially Paid", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  PAID: { label: "Paid", className: "bg-green-50 text-green-700 border-green-200" },
  OVERDUE: { label: "Overdue", className: "bg-red-50 text-red-600 border-red-200" },
  VOID: { label: "Void", className: "bg-slate-100 text-slate-400 border-slate-200" },
};

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

const VALID_STATUSES = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"];

export default async function InvoicesPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const validStatus = VALID_STATUSES.includes(status ?? "") ? status : undefined;
  const invoices = await getInvoices({ status: validStatus });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-0.5">{invoices.length} invoices</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/dashboard/invoices/new">
            <Plus className="h-4 w-4 mr-1" />
            New invoice
          </Link>
        </Button>
      </div>

      <form method="GET" className="flex flex-wrap gap-3 mb-4">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All statuses</option>
          {VALID_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_BADGE[s]?.label ?? s}</option>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm">Filter</Button>
        {status && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/invoices">Clear</Link>
          </Button>
        )}
      </form>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issue date</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No invoices found.
                </TableCell>
              </TableRow>
            )}
            {invoices.map((inv) => {
              const badge = STATUS_BADGE[inv.status];
              const balance = inv.totalAmount - inv.paidAmount;
              return (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/invoices/${inv.id}`}
                      className="font-medium text-slate-900 hover:underline text-sm"
                    >
                      {inv.refCode}
                    </Link>
                    <div className="text-xs text-muted-foreground">{inv.type}</div>
                  </TableCell>
                  <TableCell className="text-sm">{inv.client.name}</TableCell>
                  <TableCell className="text-sm">{inv.project.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={badge?.className}>
                      {badge?.label ?? inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(inv.issueDate)}</TableCell>
                  <TableCell className="text-sm">{formatDate(inv.dueDate)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatCents(inv.totalAmount, inv.currencyCode)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums text-sm ${balance > 0 ? "text-destructive" : "text-green-700"}`}>
                    {formatCents(balance, inv.currencyCode)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
