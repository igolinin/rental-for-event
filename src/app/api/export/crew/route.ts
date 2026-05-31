import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toCSV } from "@/lib/csv";

const HEADERS = [
  "refCode", "firstName", "lastName", "email", "phone",
  "type", "role", "isActive", "taxId", "emergencyContact", "notes",
];

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await prisma.crewMember.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const rows = members.map((m) => ({
    refCode: m.refCode,
    firstName: m.firstName,
    lastName: m.lastName,
    email: m.email ?? "",
    phone: m.phone ?? "",
    type: m.type,
    role: m.role ?? "",
    isActive: m.isActive,
    taxId: m.taxId ?? "",
    emergencyContact: m.emergencyContact ?? "",
    notes: m.notes ?? "",
  }));

  const csv = toCSV(rows, HEADERS);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="crew-${date}.csv"`,
    },
  });
}
