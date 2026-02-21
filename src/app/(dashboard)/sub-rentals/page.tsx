import { Metadata } from "next";
import Link from "next/link";
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
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Sub-Rentals" };

const subRentalStatusBadge: Record<string, { label: string; className: string }> = {
  REQUESTED: { label: "Requested", className: "bg-slate-100 text-slate-600 border-slate-200" },
  CONFIRMED: { label: "Confirmed", className: "bg-blue-50 text-blue-700 border-blue-200" },
  RECEIVED: { label: "Received", className: "bg-green-50 text-green-700 border-green-200" },
  RETURNED: { label: "Returned", className: "bg-purple-50 text-purple-700 border-purple-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-600 border-red-200" },
};

async function getActiveSubRentals() {
  return prisma.subRental.findMany({
    where: { status: { in: ["REQUESTED", "CONFIRMED", "RECEIVED"] } },
    include: {
      project: { select: { id: true, name: true, refCode: true } },
      items: true,
    },
    orderBy: [{ startAt: "asc" }],
  });
}

export default async function SubRentalsPage() {
  const subRentals = await getActiveSubRentals();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sub-Rentals</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Active external gear — managed per project
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/projects">View projects</Link>
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="text-right">Line items</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subRentals.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No active sub-rentals. Add them via a project.
                </TableCell>
              </TableRow>
            )}
            {subRentals.map((sr) => {
              const badge = subRentalStatusBadge[sr.status];
              return (
                <TableRow key={sr.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/projects/${sr.project.id}`}
                      className="font-medium text-slate-900 hover:underline text-sm"
                    >
                      {sr.project.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{sr.vendorName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={badge.className}>
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(sr.startAt)}</TableCell>
                  <TableCell className="text-sm">{formatDate(sr.endAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{sr.items.length}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
