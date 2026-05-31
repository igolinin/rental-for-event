import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDo } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { parseCSV, missingFields } from "@/lib/csv";
import { nanoid } from "nanoid";

const REQUIRED = ["firstName", "lastName"];
const MAX_ROWS = 500;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await canDo(session, "CREW", "CREATE")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  let text: string;
  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    text = await file.text();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const rows = parseCSV(text);
  if (rows.length === 0) return NextResponse.json({ error: "CSV is empty" }, { status: 400 });
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Max ${MAX_ROWS} rows per import` }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const missing = missingFields(row, REQUIRED);
    if (missing.length) {
      errors.push({ row: rowNum, message: `Missing required fields: ${missing.join(", ")}` });
      continue;
    }

    const type = row.type?.toUpperCase();
    if (type && type !== "EMPLOYEE" && type !== "FREELANCER") {
      errors.push({ row: rowNum, message: `type must be EMPLOYEE or FREELANCER, got: ${row.type}` });
      continue;
    }

    const isActive = row.isActive?.toLowerCase() !== "false";
    const payload = {
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email || null,
      phone: row.phone || null,
      type: (type || "FREELANCER") as "EMPLOYEE" | "FREELANCER",
      role: row.role || null,
      isActive,
      taxId: row.taxId || null,
      emergencyContact: row.emergencyContact || null,
      notes: row.notes || null,
    };

    try {
      // Upsert by email (if present) or refCode
      const matchByEmail = row.email
        ? await prisma.crewMember.findFirst({ where: { email: row.email } })
        : null;
      const matchByRef = row.refCode
        ? await prisma.crewMember.findFirst({ where: { refCode: row.refCode } })
        : null;
      const existing = matchByRef ?? matchByEmail;

      if (existing) {
        await prisma.crewMember.update({ where: { id: existing.id }, data: payload });
        updated++;
      } else {
        const refCode = row.refCode || `CRW-${nanoid(8).toUpperCase()}`;
        await prisma.crewMember.create({ data: { ...payload, refCode } });
        created++;
      }
    } catch (e) {
      errors.push({ row: rowNum, message: e instanceof Error ? e.message : "Database error" });
    }
  }

  await logAudit({
    entityType: "CrewMember",
    entityId: "bulk-import",
    action: "CREATE",
    userId: session.user.id,
    meta: { created, updated, errors: errors.length, totalRows: rows.length },
  });

  return NextResponse.json({ created, updated, errors });
}
