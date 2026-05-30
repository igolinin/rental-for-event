import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInvoiceById } from "@/server/queries/invoices";
import { InvoiceForm } from "@/components/invoices/invoice-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) return { title: "Not found" };
  return { title: `Edit Invoice ${invoice.refCode}` };
}

export default async function EditInvoicePage({ params }: PageProps) {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  // Only draft invoices can be edited
  if (invoice.status !== "DRAFT") {
    return (
      <div className="max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/invoices/${id}`}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">Edit Invoice</h1>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-muted-foreground">
            Only draft invoices can be edited. This invoice is <strong>{invoice.status}</strong>.
          </p>
        </div>
      </div>
    );
  }

  const taxRateNum = invoice.lineItems[0]?.taxRate
    ? Number(invoice.lineItems[0].taxRate)
    : null;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/invoices/${id}`}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">
          Edit Invoice {invoice.refCode}
        </h1>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <InvoiceForm
          invoiceId={id}
          projectId={invoice.projectId}
          clientId={invoice.clientId}
          defaultValues={{
            projectId: invoice.projectId,
            clientId: invoice.clientId,
            type: invoice.type,
            issueDate: invoice.issueDate.toISOString().slice(0, 10),
            dueDate: invoice.dueDate.toISOString().slice(0, 10),
            currencyCode: invoice.currencyCode,
            taxRate: taxRateNum,
            discountAmount: invoice.discountAmount,
            notes: invoice.notes ?? "",
            terms: invoice.terms ?? "",
            lineItems: invoice.lineItems.map((li) => ({
              description: li.description,
              quantity: Number(li.quantity),
              unitAmount: li.unitAmount,
              taxRate: li.taxRate ? Number(li.taxRate) : null,
              sortOrder: li.sortOrder,
            })),
          }}
        />
      </div>
    </div>
  );
}
