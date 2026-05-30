import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Plus } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getClientById } from "@/server/queries/clients";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { formatDate } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const client = await getClientById(id);
  return { title: client?.name ?? "Client" };
}

const projectStatusBadge: Record<string, { label: string; className: string }> = {
  INQUIRY: { label: "Inquiry", className: "bg-slate-100 text-slate-600 border-slate-200" },
  QUOTED: { label: "Quoted", className: "bg-blue-50 text-blue-700 border-blue-200" },
  CONFIRMED: { label: "Confirmed", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  IN_PROGRESS: { label: "In progress", className: "bg-amber-50 text-amber-700 border-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-green-50 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-600 border-red-200" },
};

const invoiceStatusBadge: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-600 border-slate-200" },
  SENT: { label: "Sent", className: "bg-blue-50 text-blue-700 border-blue-200" },
  PARTIALLY_PAID: { label: "Partial", className: "bg-amber-50 text-amber-700 border-amber-200" },
  PAID: { label: "Paid", className: "bg-green-50 text-green-700 border-green-200" },
  OVERDUE: { label: "Overdue", className: "bg-red-50 text-red-700 border-red-200" },
  VOID: { label: "Void", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/clients">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
            <span className="font-mono text-xs text-muted-foreground">{client.refCode}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/projects/new?clientId=${client.id}`}>
              <Plus className="h-4 w-4 mr-1" />
              New project
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/clients/${id}/edit`}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Link>
          </Button>
          <DeleteClientButton clientId={client.id} clientName={client.name} />
        </div>
      </div>

      {/* Contact info card */}
      <div className="rounded-lg border bg-white p-5 mb-6 max-w-xl grid grid-cols-2 gap-4">
        {[
          { label: "Contact", value: client.contactName },
          { label: "Email", value: client.email },
          { label: "Phone", value: client.phone },
          { label: "Tax ID", value: client.taxId },
          { label: "City", value: client.city },
          { label: "Country", value: client.country },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </p>
            <p className="text-sm mt-0.5">{value ?? "—"}</p>
          </div>
        ))}
        {client.address && (
          <div className="col-span-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Address
            </p>
            <p className="text-sm mt-0.5">{client.address}</p>
          </div>
        )}
        {client.notes && (
          <div className="col-span-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Notes
            </p>
            <p className="text-sm mt-0.5 text-muted-foreground">{client.notes}</p>
          </div>
        )}
      </div>

      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects">Projects ({client.projects.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({client.invoices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-4">
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name / Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.projects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                      No projects yet.
                    </TableCell>
                  </TableRow>
                )}
                {client.projects.map((p) => {
                  const badge = projectStatusBadge[p.status];
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/projects/${p.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {p.name}
                        </Link>
                        <div className="text-xs font-mono text-muted-foreground">{p.refCode}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.type.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(p.startAt)}</TableCell>
                      <TableCell className="text-sm">{formatDate(p.endAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                      No invoices yet.
                    </TableCell>
                  </TableRow>
                )}
                {client.invoices.map((inv) => {
                  const badge = invoiceStatusBadge[inv.status];
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.refCode}</TableCell>
                      <TableCell className="text-sm">{inv.type}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(inv.dueDate)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCents(inv.totalAmount, inv.currencyCode)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
