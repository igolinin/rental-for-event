"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeDb } from "@/lib/db";
import { generateRefCode, generateShortCode } from "@/lib/utils";
import {
  categorySchema,
  subCategorySchema,
  inventoryItemSchema,
  serializedUnitSchema,
  maintenanceLogSchema,
} from "@/schemas/inventory";
import { auth } from "@/lib/auth";

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function createCategory(data: unknown) {
  const parsed = categorySchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { name, description, color, sortOrder } = parsed.data;
  const result = await safeDb(
    prisma.inventoryCategory.create({ data: { name, slug: slugify(name), description, color, sortOrder } })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/categories");
  return { success: true };
}

export async function updateCategory(id: string, data: unknown) {
  const parsed = categorySchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { name, description, color, sortOrder } = parsed.data;
  const result = await safeDb(
    prisma.inventoryCategory.update({
      where: { id },
      data: { name, slug: slugify(name), description, color, sortOrder },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/categories");
  return { success: true };
}

export async function deleteCategory(id: string) {
  const countResult = await safeDb(prisma.inventoryItem.count({ where: { categoryId: id } }));
  if (countResult.isErr()) return { error: countResult.error };
  if (countResult.value > 0) return { error: "Cannot delete category with existing items." };

  const result = await safeDb(
    prisma.$transaction([
      prisma.inventorySubCategory.deleteMany({ where: { categoryId: id } }),
      prisma.inventoryCategory.delete({ where: { id } }),
    ])
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/categories");
  return { success: true };
}

export async function createSubCategory(data: unknown) {
  const parsed = subCategorySchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { categoryId, name } = parsed.data;
  const result = await safeDb(
    prisma.inventorySubCategory.create({ data: { categoryId, name, slug: slugify(name) } })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/inventory/categories");
  return { success: true };
}

export async function deleteSubCategory(id: string) {
  const countResult = await safeDb(prisma.inventoryItem.count({ where: { subCategoryId: id } }));
  if (countResult.isErr()) return { error: countResult.error };
  if (countResult.value > 0) return { error: "Cannot delete sub-category with existing items." };

  const result = await safeDb(prisma.inventorySubCategory.delete({ where: { id } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/inventory/categories");
  return { success: true };
}

// ─── Inventory Items ──────────────────────────────────────────────────────────

export async function createInventoryItem(data: unknown) {
  const parsed = inventoryItemSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const refCode = generateRefCode("INV");

  const result = await safeDb(
    prisma.inventoryItem.create({
      data: {
        refCode,
        name: d.name,
        description: d.description,
        categoryId: d.categoryId,
        subCategoryId: d.subCategoryId,
        trackingMode: d.trackingMode,
        totalQuantity: d.trackingMode === "BULK" ? d.totalQuantity : 0,
        dailyRateAmount: d.dailyRateAmount,
        dailyRateCurrency: d.dailyRateCurrency,
        replacementCostAmount: d.replacementCostAmount,
        replacementCostCurrency: d.replacementCostCurrency,
        notes: d.notes,
        isActive: d.isActive,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/inventory");
  return { success: true, id: result.value.id };
}

export async function updateInventoryItem(id: string, data: unknown) {
  const parsed = inventoryItemSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const result = await safeDb(
    prisma.inventoryItem.update({
      where: { id },
      data: {
        name: d.name,
        description: d.description,
        categoryId: d.categoryId,
        subCategoryId: d.subCategoryId,
        trackingMode: d.trackingMode,
        totalQuantity: d.trackingMode === "BULK" ? d.totalQuantity : 0,
        dailyRateAmount: d.dailyRateAmount,
        dailyRateCurrency: d.dailyRateCurrency,
        replacementCostAmount: d.replacementCostAmount,
        replacementCostCurrency: d.replacementCostCurrency,
        notes: d.notes,
        isActive: d.isActive,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/dashboard/inventory/${id}`);
  return { success: true };
}

export async function archiveInventoryItem(id: string) {
  const result = await safeDb(
    prisma.inventoryItem.update({ where: { id }, data: { isActive: false } })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

// ─── Serialized Units ─────────────────────────────────────────────────────────

export async function addSerializedUnit(inventoryItemId: string, data: unknown) {
  const parsed = serializedUnitSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const result = await safeDb(
    prisma.serializedUnit.create({
      data: {
        inventoryItemId,
        serialNumber: d.serialNumber,
        assetTag: d.assetTag,
        status: d.status,
        purchaseDate: d.purchaseDate ? new Date(d.purchaseDate) : null,
        purchasePriceAmount: d.purchasePriceAmount,
        purchasePriceCurrency: d.purchasePriceCurrency,
        notes: d.notes,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  return { success: true };
}

export async function updateSerializedUnit(unitId: string, inventoryItemId: string, data: unknown) {
  const parsed = serializedUnitSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const result = await safeDb(
    prisma.serializedUnit.update({
      where: { id: unitId },
      data: {
        serialNumber: d.serialNumber,
        assetTag: d.assetTag,
        status: d.status,
        purchaseDate: d.purchaseDate ? new Date(d.purchaseDate) : null,
        purchasePriceAmount: d.purchasePriceAmount,
        purchasePriceCurrency: d.purchasePriceCurrency,
        notes: d.notes,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  return { success: true };
}

export async function deleteSerializedUnit(unitId: string, inventoryItemId: string) {
  const allocResult = await safeDb(
    prisma.projectEquipmentAllocation.count({ where: { serializedUnitId: unitId } })
  );
  if (allocResult.isErr()) return { error: allocResult.error };
  if (allocResult.value > 0) return { error: "Cannot delete unit that has project allocations." };

  const result = await safeDb(prisma.serializedUnit.delete({ where: { id: unitId } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  return { success: true };
}

// ─── Maintenance Logs ─────────────────────────────────────────────────────────

export async function createMaintenanceLog(data: unknown) {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated." };

  const parsed = maintenanceLogSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const result = await safeDb(
    prisma.$transaction(async (tx) => {
      const log = await tx.maintenanceLog.create({
        data: {
          inventoryItemId: d.inventoryItemId,
          serializedUnitId: d.serializedUnitId,
          type: d.type,
          description: d.description,
          status: d.status,
          reportedAt: d.reportedAt ? new Date(d.reportedAt) : new Date(),
          startedAt: d.startedAt ? new Date(d.startedAt) : null,
          completedAt: d.completedAt ? new Date(d.completedAt) : null,
          vendor: d.vendor,
          technicianName: d.technicianName,
          costAmount: d.costAmount,
          costCurrency: d.costCurrency,
          loggedById: session.user.id,
          notes: d.notes,
        },
      });

      if (log.serializedUnitId && (log.status === "OPEN" || log.status === "IN_PROGRESS")) {
        await tx.serializedUnit.update({
          where: { id: log.serializedUnitId },
          data: { status: "IN_REPAIR" },
        });
      }
      return log;
    })
  );

  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/inventory/${d.inventoryItemId}`);
  revalidatePath("/dashboard/maintenance");
  return { success: true };
}

export async function updateMaintenanceLogStatus(
  logId: string,
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
) {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated." };

  const result = await safeDb(
    prisma.$transaction(async (tx) => {
      const log = await tx.maintenanceLog.update({
        where: { id: logId },
        data: {
          status,
          ...(status === "IN_PROGRESS" ? { startedAt: new Date() } : {}),
          ...(status === "COMPLETED" || status === "CANCELLED" ? { completedAt: new Date() } : {}),
        },
      });

      if (log.serializedUnitId) {
        if (status === "COMPLETED" || status === "CANCELLED") {
          await tx.serializedUnit.update({
            where: { id: log.serializedUnitId },
            data: { status: "AVAILABLE" },
          });
        } else {
          await tx.serializedUnit.update({
            where: { id: log.serializedUnitId },
            data: { status: "IN_REPAIR" },
          });
        }
      }
      return log;
    })
  );

  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/inventory");
  return { success: true };
}
