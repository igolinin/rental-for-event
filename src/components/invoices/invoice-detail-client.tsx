"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Pencil, Printer, Trash2 } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { paymentSchema, type PaymentFormValues } from "@/schemas/invoices";
import {
  addPayment,
  deletePayment,
  updateInvoiceStatus,
} from "@/server/actions/invoices";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import type { InvoiceDetail } from "@/server/queries/invoices";

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
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

type StatusTransition = "SENT" | "OVERDUE" | "VOID" | "DRAFT";

const STATUS_TRANSITIONS: Record<string, StatusTransition[]> = {
  DRAFT: ["SENT", "VOID"],
  SENT: ["OVERDUE", "VOID"],
  PARTIALLY_PAID: ["OVERDUE", "VOID"],
  OVERDUE: ["VOID"],
  PAID: [],
  VOID: [],
};

interface InvoiceDetailClientProps {
  invoice: NonNullable<InvoiceDetail>;
}

export function InvoiceDetailClient({ invoice }: InvoiceDetailClientProps) {
  const router = useRouter();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      currency: invoice.currencyCode,
      method: "BANK_TRANSFER",
      receivedAt: new Date().toISOString().slice(0, 10),
      reference: "",
      notes: "",
    },
  });

  async function onAddPayment(values: PaymentFormValues) {
    setIsPending(true);
    try {
      const result = await addPayment(invoice.id, values);
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error recording payment" });
        return;
      }
      toast({ title: "Payment recorded" });
      setPaymentDialogOpen(false);
      paymentForm.reset();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    await deletePayment(paymentId, invoice.id);
    toast({ title: "Payment removed" });
    router.refresh();
  }

  async function handleStatusChange(status: StatusTransition) {
    const result = await updateInvoiceStatus(invoice.id, status);
    if ("error" in result && result.error) {
      toast({ variant: "destructive", title: String(result.error) });
      return;
    }
    toast({ title: `Invoice marked as ${status.toLowerCase()}` });
    router.refresh();
  }

  const badge = STATUS_BADGE[invoice.status];
  const transitions = STATUS_TRANSITIONS[invoice.status] ?? [];
  const remaining = invoice.totalAmount - invoice.paidAmount;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/invoices">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Invoice {invoice.refCode}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={badge.className}>
                {badge.label}
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">{invoice.type}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {transitions.map((status) => (
            <Button
              key={status}
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange(status)}
            >
              Mark {status.toLowerCase()}
            </Button>
          ))}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/invoices/${invoice.id}/print`} target="_blank">
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Link>
          </Button>
          {invoice.status === "DRAFT" && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/invoices/${invoice.id}/edit`}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Meta card */}
      <div className="max-w-2xl rounded-lg border bg-white p-5 mb-6 grid grid-cols-2 gap-4 text-sm">
        {[
          { label: "Client", value: invoice.client.name },
          { label: "Project", value: invoice.project.name },
          { label: "Issue date", value: formatDate(invoice.issueDate) },
          { label: "Due date", value: formatDate(invoice.dueDate) },
          { label: "Currency", value: invoice.currencyCode },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="mt-0.5 font-medium">{value}</p>
          </div>
        ))}
      </div>

      {/* Line items */}
      <h2 className="font-semibold text-sm mb-2">Line items</h2>
      <div className="rounded-md border bg-white mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/2">Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.lineItems.map((li) => (
              <TableRow key={li.id}>
                <TableCell className="text-sm">{li.description}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {Number(li.quantity).toFixed(2)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {formatCents(li.unitAmount, invoice.currencyCode)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {formatCents(li.totalAmount, invoice.currencyCode)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="text-sm space-y-1 min-w-56">
          <div className="flex justify-between gap-10">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatCents(invoice.subtotalAmount, invoice.currencyCode)}</span>
          </div>
          {invoice.taxAmount > 0 && (
            <div className="flex justify-between gap-10">
              <span className="text-muted-foreground">Tax</span>
              <span className="tabular-nums">{formatCents(invoice.taxAmount, invoice.currencyCode)}</span>
            </div>
          )}
          {invoice.discountAmount > 0 && (
            <div className="flex justify-between gap-10">
              <span className="text-muted-foreground">Discount</span>
              <span className="tabular-nums text-destructive">
                −{formatCents(invoice.discountAmount, invoice.currencyCode)}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-10 font-semibold border-t pt-1">
            <span>Total</span>
            <span className="tabular-nums">{formatCents(invoice.totalAmount, invoice.currencyCode)}</span>
          </div>
          <div className="flex justify-between gap-10">
            <span className="text-muted-foreground">Paid</span>
            <span className="tabular-nums text-green-700">{formatCents(invoice.paidAmount, invoice.currencyCode)}</span>
          </div>
          <div className="flex justify-between gap-10 font-semibold">
            <span>Balance due</span>
            <span className={`tabular-nums ${remaining > 0 ? "text-destructive" : "text-green-700"}`}>
              {formatCents(remaining, invoice.currencyCode)}
            </span>
          </div>
        </div>
      </div>

      {/* Payments */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-sm">Payments ({invoice.payments.length})</h2>
        {invoice.status !== "PAID" && invoice.status !== "VOID" && (
          <Button size="sm" onClick={() => setPaymentDialogOpen(true)}>
            Record payment
          </Button>
        )}
      </div>
      <div className="rounded-md border bg-white mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground text-sm">
                  No payments recorded.
                </TableCell>
              </TableRow>
            )}
            {invoice.payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm">{formatDate(p.receivedAt)}</TableCell>
                <TableCell className="text-sm">{p.method.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-sm">{p.reference ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {formatCents(p.amount, p.currency)}
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
                        <AlertDialogTitle>Remove payment?</AlertDialogTitle>
                        <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeletePayment(p.id)}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Notes / Terms */}
      {(invoice.notes || invoice.terms) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl text-sm">
          {invoice.notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Terms</p>
              <p className="whitespace-pre-wrap">{invoice.terms}</p>
            </div>
          )}
        </div>
      )}

      {/* Payment dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(onAddPayment)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={paymentForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (cents) *</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paymentForm.control}
                  name="receivedAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paymentForm.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Method *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                          <SelectItem value="CHECK">Check</SelectItem>
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="CARD">Card</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paymentForm.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving…" : "Record"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
