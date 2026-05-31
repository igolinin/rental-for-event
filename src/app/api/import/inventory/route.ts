import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDo } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { parseCSV, missingFields } from "@/lib/csv";
import { nanoid } from "nanoid";

const REQUIRED = ["name", "category", "trackingMode"];
const MAX_ROWS = 500;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await canDo(session, "INVENTORY", "CREATE")) {
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
    const rowNum = i + 2; // 1-indexed + header

    const missing = missingFields(row, REQUIRED);
    if (missing.length) {
      errors.push({ row: rowNum, message: `Missing required fields: ${missing.join(", ")}` });
      continue;
    }

    const trackingMode = row.trackingMode?.toUpperCase();
    if (trackingMode !== "SERIALIZED" && trackingMode !== "BULK") {
      errors.push({ row: rowNum, message: `trackingMode must be SERIALIZED or BULK, got: ${row.trackingMode}` });
      continue;
    }

    // Find or create category
    let category = await prisma.inventoryCategory.findFirst({
      where: { name: { equals: row.category, mode: "insensitive" } },
    });
    if (!category) {
      const slug = row.category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      try {
        category = await prisma.inventoryCategory.create({
          data: { name: row.category, slug: `${slug}-${nanoid(4)}` },
        });
      } catch {
        errors.push({ row: rowNum, message: `Could not create category: ${row.category}` });
        continue;
      }
    }

    const dailyRateAmount = row.dailyRateAmount ? parseInt(row.dailyRateAmount, 10) : null;
    const replacementCostAmount = row.replacementCostAmount ? parseInt(row.replacementCostAmount, 10) : null;
    const totalQuantity = trackingMode === "BULK" ? (parseInt(row.totalQuantity, 10) || 0) : 0;
    const isActive = row.isActive?.toLowerCase() !== "false";

    const payload = {
      name: row.name,
      description: row.description || null,
      categoryId: category.id,
      trackingMode: trackingMode as "SERIALIZED" | "BULK",
      totalQuantity,
      dailyRateAmount: isNaN(dailyRateAmount!) ? null : dailyRateAmount,
      dailyRateCurrency: row.dailyRateCurrency || "USD",
      replacementCostAmount: isNaN(replacementCostAmount!) ? null : replacementCostAmount,
      replacementCostCurrency: row.replacementCostCurrency || "USD",
      notes: row.notes || null,
      isActive,
    };

    try {
      if (row.refCode) {
        // Upsert by refCode
        const existing = await prisma.inventoryItem.findUnique({ where: { refCode: row.refCode } });
        if (existing) {
          await prisma.inventoryItem.update({ where: { refCode: row.refCode }, data: payload });
          updated++;
        } else {
          await prisma.inventoryItem.create({ data: { ...payload, refCode: row.refCode } });
          created++;
        }
      } else {
        // Create new with generated refCode
        const refCode = `INV-${nanoid(8).toUpperCase()}`;
        await prisma.inventoryItem.create({ data: { ...payload, refCode } });
        created++;
      }
    } catch (e) {
      errors.push({ row: rowNum, message: e instanceof Error ? e.message : "Database error" });
    }
  }

  await logAudit({
    entityType: "InventoryItem",
    entityId: "bulk-import",
    action: "CREATE",
    userId: session.user.id,
    meta: { created, updated, errors: errors.length, totalRows: rows.length },
  });

  return NextResponse.json({ created, updated, errors });
}
