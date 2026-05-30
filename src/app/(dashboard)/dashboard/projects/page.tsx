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
import { getProjects } from "@/server/queries/projects";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects" };

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string }>;
}

const projectStatusBadge: Record<string, { label: string; className: string }> = {
  INQUIRY: { label: "Inquiry", className: "bg-slate-100 text-slate-600 border-slate-200" },
  QUOTED: { label: "Quoted", className: "bg-blue-50 text-blue-700 border-blue-200" },
  CONFIRMED: { label: "Confirmed", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  IN_PROGRESS: { label: "In progress", className: "bg-amber-50 text-amber-700 border-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-green-50 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-600 border-red-200" },
};

export default async function ProjectsPage({ searchParams }: PageProps) {
  const { status, q } = await searchParams;
  const projects = await getProjects({ status, search: q });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-0.5">{projects.length} projects</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/dashboard/projects/new">
            <Plus className="h-4 w-4 mr-1" />
            New project
          </Link>
        </Button>
      </div>

      <form method="GET" className="flex flex-wrap gap-3 mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search projects…"
          className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All statuses</option>
          <option value="INQUIRY">Inquiry</option>
          <option value="QUOTED">Quoted</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <Button type="submit" variant="outline" size="sm">Filter</Button>
        {(status || q) && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/projects">Clear</Link>
          </Button>
        )}
      </form>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name / Code</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead className="text-right">Kit items</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No projects found.
                </TableCell>
              </TableRow>
            )}
            {projects.map((p) => {
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
                  <TableCell className="text-sm">{p.client.name}</TableCell>
                  <TableCell className="text-sm">{p.type.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={badge.className}>
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(p.startAt)}</TableCell>
                  <TableCell className="text-sm">{formatDate(p.endAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{p._count.equipmentItems}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
