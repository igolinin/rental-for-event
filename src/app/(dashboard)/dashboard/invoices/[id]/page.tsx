import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getInvoiceById } from "@/server/queries/invoices";
import { serializeDecimals } from "@/lib/serialize";
import { InvoiceDetailClient } from "@/components/invoices/invoice-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) return { title: "Not found" };
  return { title: `Invoice ${invoice.refCode}` };
}

export default async function InvoicePage({ params }: PageProps) {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  return <InvoiceDetailClient invoice={serializeDecimals(invoice)} />;
}
