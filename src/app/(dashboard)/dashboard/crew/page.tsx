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
import { getCrewMembers } from "@/server/queries/crew";
import { CsvImportExport } from "@/components/shared/csv-import-export";

export const metadata: Metadata = { title: "Crew" };

interface PageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function CrewPage({ searchParams }: PageProps) {
  const { q, type } = await searchParams;
  const crew = await getCrewMembers({
    search: q,
    type: type === "EMPLOYEE" || type === "FREELANCER" ? type : undefined,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Crew</h1>
          <p className="text-sm text-slate-500 mt-0.5">{crew.length} members</p>
        </div>
        <div className="flex gap-2">
          <CsvImportExport
            exportUrl="/api/export/crew"
            importUrl="/api/import/crew"
            entityLabel="crew"
            templateHeaders="refCode,firstName,lastName,email,phone,type,role,isActive,taxId,emergencyContact,notes"
          />
          <Button size="sm" asChild>
            <Link href="/dashboard/crew/new">
              <Plus className="h-4 w-4 mr-1" />
              Add crew member
            </Link>
          </Button>
        </div>
      </div>

      <form method="GET" className="flex flex-wrap gap-3 mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search crew…"
          className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <select
          name="type"
          defaultValue={type ?? ""}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All types</option>
          <option value="EMPLOYEE">Employees</option>
          <option value="FREELANCER">Freelancers</option>
        </select>
        <Button type="submit" variant="outline" size="sm">Filter</Button>
        {(q || type) && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/crew">Clear</Link>
          </Button>
        )}
      </form>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name / Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Assignments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {crew.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No crew members found.
                </TableCell>
              </TableRow>
            )}
            {crew.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/crew/${m.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {m.firstName} {m.lastName}
                  </Link>
                  <div className="text-xs font-mono text-muted-foreground">{m.refCode}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {m.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{m.role ?? "—"}</TableCell>
                <TableCell className="text-sm">{m.email ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{m._count.assignments}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
