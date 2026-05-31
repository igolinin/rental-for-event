import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toCSV } from "@/lib/csv";

const HEADERS = [
  "refCode", "name", "description", "category", "subCategory",
  "trackingMode", "totalQuantity",
  "dailyRateAmount", "dailyRateCurrency",
  "replacementCostAmount", "replacementCostCurrency",
  "notes", "isActive",
];

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.inventoryItem.findMany({
    include: {
      category: { select: { name: true } },
      subCategory: { select: { name: true } },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });

  const rows = items.map((item) => ({
    refCode: item.refCode,
    name: item.name,
    description: item.description ?? "",
    category: item.category.name,
    subCategory: item.subCategory?.name ?? "",
    trackingMode: item.trackingMode,
    totalQuantity: item.totalQuantity,
    dailyRateAmount: item.dailyRateAmount ?? "",
    dailyRateCurrency: item.dailyRateCurrency,
    replacementCostAmount: item.replacementCostAmount ?? "",
    replacementCostCurrency: item.replacementCostCurrency,
    notes: item.notes ?? "",
    isActive: item.isActive,
  }));

  const csv = toCSV(rows, HEADERS);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-${date}.csv"`,
    },
  });
}
