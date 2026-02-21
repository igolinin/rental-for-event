/**
 * Inventory availability algorithm.
 *
 * Unified interface for both SERIALIZED and BULK tracking modes.
 * Called on every equipment allocation and inventory search with a date filter.
 */

import { prisma } from "@/lib/prisma";
import { TrackingMode } from "@prisma/client";

/**
 * Get the available quantity of an inventory item for a given date range.
 *
 * @param inventoryItemId - The item to check
 * @param startAt - Booking start (inclusive)
 * @param endAt - Booking end (inclusive)
 * @param excludeProjectId - Optionally exclude a project's own allocations (for editing)
 * @returns Available count (units or quantity)
 */
export async function getAvailableQuantity(
  inventoryItemId: string,
  startAt: Date,
  endAt: Date,
  excludeProjectId?: string
): Promise<number> {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: inventoryItemId },
    include: {
      serializedUnits: true,
    },
  });

  if (!item || !item.isActive) return 0;

  if (item.trackingMode === TrackingMode.SERIALIZED) {
    return getAvailableSerializedUnits(item, startAt, endAt, excludeProjectId);
  } else {
    return getAvailableBulkQuantity(item, startAt, endAt, excludeProjectId);
  }
}

/**
 * For SERIALIZED items: count units not allocated to overlapping projects
 * AND not currently IN_REPAIR.
 */
async function getAvailableSerializedUnits(
  item: Awaited<ReturnType<typeof prisma.inventoryItem.findUnique>> & {
    serializedUnits: Array<{ id: string; status: string }>;
  },
  startAt: Date,
  endAt: Date,
  excludeProjectId?: string
): Promise<number> {
  if (!item) return 0;

  // Find all serial unit IDs allocated to overlapping projects
  const allocatedUnitIds = await getAllocatedSerializedUnitIds(
    item.id,
    startAt,
    endAt,
    excludeProjectId
  );

  const unavailableIds = new Set([
    ...allocatedUnitIds,
    ...item.serializedUnits
      .filter((u) => u.status === "IN_REPAIR" || u.status === "RETIRED")
      .map((u) => u.id),
  ]);

  return item.serializedUnits.filter(
    (u) => !unavailableIds.has(u.id)
  ).length;
}

/**
 * For BULK items: total quantity minus allocated quantity in overlapping date ranges.
 */
async function getAvailableBulkQuantity(
  item: Awaited<ReturnType<typeof prisma.inventoryItem.findUnique>>,
  startAt: Date,
  endAt: Date,
  excludeProjectId?: string
): Promise<number> {
  if (!item) return 0;

  const allocatedQuantity = await getAllocatedBulkQuantity(
    item.id,
    startAt,
    endAt,
    excludeProjectId
  );

  return Math.max(0, item.totalQuantity - allocatedQuantity);
}

/**
 * Find all SerializedUnit IDs allocated to projects whose dates overlap
 * the requested range.
 */
async function getAllocatedSerializedUnitIds(
  inventoryItemId: string,
  startAt: Date,
  endAt: Date,
  excludeProjectId?: string
): Promise<string[]> {
  const allocations = await prisma.projectEquipmentAllocation.findMany({
    where: {
      projectEquipmentItem: {
        inventoryItemId,
        project: {
          // Date overlap: project started before endAt AND ends after startAt
          startAt: { lte: endAt },
          endAt: { gte: startAt },
          status: {
            notIn: ["CANCELLED", "COMPLETED"],
          },
          ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
        },
      },
    },
    select: { serializedUnitId: true },
  });

  return allocations.map((a) => a.serializedUnitId);
}

/**
 * Sum the quantity of a BULK item allocated across overlapping projects.
 */
async function getAllocatedBulkQuantity(
  inventoryItemId: string,
  startAt: Date,
  endAt: Date,
  excludeProjectId?: string
): Promise<number> {
  const lineItems = await prisma.projectEquipmentItem.findMany({
    where: {
      inventoryItemId,
      project: {
        startAt: { lte: endAt },
        endAt: { gte: startAt },
        status: {
          notIn: ["CANCELLED", "COMPLETED"],
        },
        ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
      },
    },
    select: { quantityNeeded: true },
  });

  return lineItems.reduce((sum, item) => sum + item.quantityNeeded, 0);
}

/**
 * Check if a specific serialized unit is available for a date range.
 */
export async function isSerializedUnitAvailable(
  serializedUnitId: string,
  startAt: Date,
  endAt: Date,
  excludeProjectId?: string
): Promise<boolean> {
  const unit = await prisma.serializedUnit.findUnique({
    where: { id: serializedUnitId },
  });

  if (!unit) return false;
  if (unit.status === "IN_REPAIR" || unit.status === "RETIRED") return false;

  const existingAllocation = await prisma.projectEquipmentAllocation.findFirst({
    where: {
      serializedUnitId,
      projectEquipmentItem: {
        project: {
          startAt: { lte: endAt },
          endAt: { gte: startAt },
          status: { notIn: ["CANCELLED", "COMPLETED"] },
          ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
        },
      },
    },
  });

  return !existingAllocation;
}
