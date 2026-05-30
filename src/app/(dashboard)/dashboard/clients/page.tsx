import { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getClients } from "@/server/queries/clients";

export const metadata: Metadata = { title: "Clients" };

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function ClientsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const clients = await getClients({ search: q });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">{clients.length} clients</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/dashboard/clients/new">
            <Plus className="h-4 w-4 mr-1" />
            Add client
          </Link>
        </Button>
      </div>

      <form method="GET" className="flex gap-3 mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search clients…"
          className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button type="submit" variant="outline" size="sm">Search</Button>
        {q && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/clients">Clear</Link>
          </Button>
        )}
      </form>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name / Code</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Projects</TableHead>
              <TableHead className="text-right">Invoices</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No clients found.
                </TableCell>
              </TableRow>
            )}
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/clients/${client.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {client.name}
                  </Link>
                  <div className="text-xs text-muted-foreground font-mono">
                    {client.refCode}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{client.contactName ?? "—"}</TableCell>
                <TableCell className="text-sm">{client.email ?? "—"}</TableCell>
                <TableCell className="text-sm">{client.phone ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{client._count.projects}</TableCell>
                <TableCell className="text-right tabular-nums">{client._count.invoices}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
