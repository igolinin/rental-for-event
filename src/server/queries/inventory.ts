import { prisma } from "@/lib/prisma";

// ─── Categories ──────────────────────────────────────────────────────────────

export async function getCategories() {
  return prisma.inventoryCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      subCategories: { orderBy: { name: "asc" } },
      _count: { select: { items: true } },
    },
  });
}

export type CategoryWithSubs = Awaited<ReturnType<typeof getCategories>>[number];

// ─── Items (list) ─────────────────────────────────────────────────────────────

export interface GetItemsParams {
  search?: string;
  categoryId?: string;
  trackingMode?: "SERIALIZED" | "BULK";
  isActive?: boolean;
}

export async function getItems(params: GetItemsParams = {}) {
  const { search, categoryId, trackingMode, isActive = true } = params;

  return prisma.inventoryItem.findMany({
    where: {
      isActive,
      ...(categoryId ? { categoryId } : {}),
      ...(trackingMode ? { trackingMode } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { refCode: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      category: true,
      subCategory: true,
      _count: { select: { serializedUnits: true } },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });
}

export type ItemListEntry = Awaited<ReturnType<typeof getItems>>[number];

// ─── Single Item ──────────────────────────────────────────────────────────────

export async function getItemById(id: string) {
  return prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      category: true,
      subCategory: true,
      serializedUnits: {
        orderBy: { serialNumber: "asc" },
      },
      maintenanceLogs: {
        include: {
          loggedBy: { select: { id: true, name: true } },
          serializedUnit: { select: { id: true, serialNumber: true } },
        },
        orderBy: { reportedAt: "desc" },
        take: 20,
      },
    },
  });
}

export type ItemDetail = Awaited<ReturnType<typeof getItemById>>;

// ─── Maintenance (global queue) ──────────────────────────────────────────────

export interface GetMaintenanceParams {
  status?: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  categoryId?: string;
}

export async function getMaintenanceLogs(params: GetMaintenanceParams = {}) {
  const { status, categoryId } = params;

  return prisma.maintenanceLog.findMany({
    where: {
      ...(status ? { status } : { status: { in: ["OPEN", "IN_PROGRESS"] } }),
      ...(categoryId
        ? { inventoryItem: { categoryId } }
        : {}),
    },
    include: {
      inventoryItem: {
        include: { category: true },
      },
      serializedUnit: true,
      loggedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { reportedAt: "desc" }],
  });
}

export type MaintenanceLogEntry = Awaited<
  ReturnType<typeof getMaintenanceLogs>
>[number];
