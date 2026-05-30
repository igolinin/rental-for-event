import { prisma } from "@/lib/prisma";

export async function getWarehouses(activeOnly = false) {
  return prisma.warehouse.findMany({
    where: activeOnly ? { isActive: true } : {},
    include: {
      _count: { select: { serializedUnits: true, inventoryStocks: true } },
    },
    orderBy: { name: "asc" },
  });
}

export type WarehouseListEntry = Awaited<ReturnType<typeof getWarehouses>>[number];

export async function getWarehouseForSelect() {
  return prisma.warehouse.findMany({
    where: { isActive: true },
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
  });
}

export type WarehouseSelectEntry = Awaited<ReturnType<typeof getWarehouseForSelect>>[number];
