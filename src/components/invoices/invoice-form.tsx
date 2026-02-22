"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { invoiceSchema, type InvoiceFormValues } from "@/schemas/invoices";
import { createInvoice, updateInvoice } from "@/server/actions/invoices";
import { toast } from "@/hooks/use-toast";

interface InvoiceFormProps {
  invoiceId?: string;
  defaultValues?: Partial<InvoiceFormValues>;
  projectId?: string;
  clientId?: string;
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function InvoiceForm({
  invoiceId,
  defaultValues,
  projectId,
  clientId,
}: InvoiceFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const dueIn30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      projectId: projectId ?? "",
      clientId: clientId ?? "",
      type: "STANDARD",
      issueDate: today,
      dueDate: dueIn30,
      currencyCode: "USD",
      taxRate: null,
      discountAmount: 0,
      notes: "",
      terms: "Net 30",
      lineItems: [{ description: "", quantity: 1, unitAmount: 0, sortOrder: 0 }],
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const watchedLineItems = form.watch("lineItems");
  const taxRate = form.watch("taxRate");
  const discountAmount = form.watch("discountAmount") ?? 0;

  const subtotal = watchedLineItems.reduce(
    (sum, li) => sum + Math.round((li.quantity || 0) * (li.unitAmount || 0)),
    0
  );
  const tax = Math.round(subtotal * (taxRate || 0));
  const total = Math.max(0, subtotal + tax - (discountAmount || 0));

  async function onSubmit(values: InvoiceFormValues) {
    setIsPending(true);
    try {
      const result = invoiceId
        ? await updateInvoice(invoiceId, values)
        : await createInvoice(values);

      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Error saving invoice" });
        return;
      }

      toast({ title: invoiceId ? "Invoice updated" : "Invoice created" });

      if (!invoiceId && "id" in result && result.id) {
        router.push(`/dashboard/invoices/${result.id}`);
      } else {
        router.push("/dashboard/invoices");
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header fields */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="STANDARD">Standard</SelectItem>
                    <SelectItem value="DEPOSIT">Deposit</SelectItem>
                    <SelectItem value="FINAL">Final</SelectItem>
                    <SelectItem value="CREDIT_NOTE">Credit note</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="issueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currencyCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency *</FormLabel>
                <FormControl>
                  <Input placeholder="USD" maxLength={3} {...field} className="uppercase" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="taxRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax rate (e.g. 0.1 = 10%)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.001"
                    min={0}
                    max={1}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="discountAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount (cents)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Line items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-sm">Line items</h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                append({ description: "", quantity: 1, unitAmount: 0, sortOrder: fields.length })
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Add line
            </Button>
          </div>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/2">Description</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit (cents)</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, idx) => {
                  const qty = watchedLineItems[idx]?.quantity || 0;
                  const unit = watchedLineItems[idx]?.unitAmount || 0;
                  const lineTotal = Math.round(qty * unit);
                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Input
                          {...form.register(`lineItems.${idx}.description`)}
                          placeholder="Description"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          {...form.register(`lineItems.${idx}.quantity`, { valueAsNumber: true })}
                          type="number"
                          step="0.01"
                          min={0}
                          className="h-8 w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          {...form.register(`lineItems.${idx}.unitAmount`, { valueAsNumber: true })}
                          type="number"
                          min={0}
                          className="h-8 w-28"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        ${formatCents(lineTotal)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(idx)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {/* Totals summary */}
          <div className="flex justify-end mt-3">
            <div className="text-sm space-y-1 min-w-48">
              <div className="flex justify-between gap-8">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">${formatCents(subtotal)}</span>
              </div>
              {tax !== 0 && (
                <div className="flex justify-between gap-8">
                  <span className="text-muted-foreground">Tax ({((taxRate || 0) * 100).toFixed(1)}%)</span>
                  <span className="tabular-nums">${formatCents(tax)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between gap-8">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="tabular-nums text-destructive">−${formatCents(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between gap-8 font-semibold border-t pt-1">
                <span>Total</span>
                <span className="tabular-nums">${formatCents(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea rows={3} value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment terms</FormLabel>
                <FormControl>
                  <Textarea rows={3} value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : invoiceId ? "Save changes" : "Create invoice"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
