import { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { getProjectById } from "@/server/queries/projects";
import { buildInvoiceLinesFromProject } from "@/server/queries/invoices";

export const metadata: Metadata = { title: "New invoice" };

interface PageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function NewInvoicePage({ searchParams }: PageProps) {
  const { projectId } = await searchParams;

  // Pre-populate from project kit list if projectId supplied
  let defaultValues: Record<string, unknown> | undefined;
  const resolvedProjectId = projectId;
  let resolvedClientId: string | undefined;

  if (projectId) {
    const [project, built] = await Promise.all([
      getProjectById(projectId),
      buildInvoiceLinesFromProject(projectId),
    ]);
    if (project && built) {
      resolvedClientId = project.clientId;
      defaultValues = {
        projectId,
        clientId: project.clientId,
        currencyCode: built.currencyCode,
        discountAmount: built.discountAmount,
        notes: `Invoice for project: ${project.name}`,
        lineItems: built.lineItems.length
          ? built.lineItems
          : [{ description: "", quantity: 1, unitAmount: 0, sortOrder: 0 }],
      };
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/invoices">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">New invoice</h1>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <InvoiceForm
          projectId={resolvedProjectId}
          clientId={resolvedClientId}
          defaultValues={defaultValues as never}
        />
      </div>
    </div>
  );
}
