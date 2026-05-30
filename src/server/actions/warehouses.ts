"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeDb } from "@/lib/db";
import { warehouseSchema } from "@/schemas/warehouses";

export async function createWarehouse(data: unknown) {
  const parsed = warehouseSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const result = await safeDb(
    prisma.warehouse.create({
      data: {
        name: d.name,
        address: d.address || null,
        city: d.city || null,
        country: d.country || null,
        isActive: d.isActive,
      },
    })
  );

  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/warehouses");
  return { success: true, id: result.value.id };
}

export async function updateWarehouse(id: string, data: unknown) {
  const parsed = warehouseSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const result = await safeDb(
    prisma.warehouse.update({
      where: { id },
      data: {
        name: d.name,
        address: d.address || null,
        city: d.city || null,
        country: d.country || null,
        isActive: d.isActive,
      },
    })
  );

  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/warehouses");
  return { success: true };
}

export async function toggleWarehouseActive(id: string, isActive: boolean) {
  const result = await safeDb(
    prisma.warehouse.update({ where: { id }, data: { isActive } })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/warehouses");
  return { success: true };
}

export async function upsertWarehouseStock(
  inventoryItemId: string,
  warehouseId: string,
  quantity: number
) {
  if (quantity < 0) return { error: "Quantity cannot be negative." };

  const result = await safeDb(
    prisma.$transaction(async (tx) => {
      await tx.inventoryItemWarehouseStock.upsert({
        where: { inventoryItemId_warehouseId: { inventoryItemId, warehouseId } },
        create: { inventoryItemId, warehouseId, quantity },
        update: { quantity },
      });

      // Recompute global totalQuantity as sum of all warehouse stocks
      const agg = await tx.inventoryItemWarehouseStock.aggregate({
        where: { inventoryItemId },
        _sum: { quantity: true },
      });

      await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { totalQuantity: agg._sum.quantity ?? 0 },
      });
    })
  );

  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  revalidatePath("/dashboard/warehouses");
  return { success: true };
}
