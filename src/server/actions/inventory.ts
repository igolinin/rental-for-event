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
  propertyDefSchema,
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
        warehouseId: d.warehouseId || null,
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
        warehouseId: d.warehouseId || null,
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

// ─── Item Images ──────────────────────────────────────────────────────────────

export async function addInventoryImage(
  inventoryItemId: string,
  url: string,
  caption?: string
) {
  // If no images exist yet, make this one primary
  const existingCount = await safeDb(
    prisma.inventoryItemImage.count({ where: { inventoryItemId } })
  );
  const isPrimary = existingCount.isOk() && existingCount.value === 0;

  const maxSort = await safeDb(
    prisma.inventoryItemImage.aggregate({
      where: { inventoryItemId },
      _max: { sortOrder: true },
    })
  );
  const sortOrder = maxSort.isOk() ? (maxSort.value._max.sortOrder ?? -1) + 1 : 0;

  const result = await safeDb(
    prisma.inventoryItemImage.create({
      data: { inventoryItemId, url, caption: caption || null, sortOrder, isPrimary },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  revalidatePath("/dashboard/inventory");
  return { success: true, id: result.value.id };
}

export async function deleteInventoryImage(imageId: string, inventoryItemId: string) {
  const imgResult = await safeDb(
    prisma.inventoryItemImage.findUnique({ where: { id: imageId } })
  );
  if (imgResult.isErr()) return { error: imgResult.error };
  const wasPrimary = imgResult.value?.isPrimary ?? false;

  const result = await safeDb(prisma.inventoryItemImage.delete({ where: { id: imageId } }));
  if (result.isErr()) return { error: result.error };

  // If deleted image was primary, promote the next one
  if (wasPrimary) {
    const next = await prisma.inventoryItemImage.findFirst({
      where: { inventoryItemId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.inventoryItemImage.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  }

  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function setPrimaryImage(imageId: string, inventoryItemId: string) {
  const result = await safeDb(
    prisma.$transaction([
      prisma.inventoryItemImage.updateMany({
        where: { inventoryItemId },
        data: { isPrimary: false },
      }),
      prisma.inventoryItemImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      }),
    ])
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function updateImageCaption(imageId: string, inventoryItemId: string, caption: string) {
  const result = await safeDb(
    prisma.inventoryItemImage.update({ where: { id: imageId }, data: { caption: caption || null } })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  return { success: true };
}

// ─── Property Definitions ─────────────────────────────────────────────────────

export async function createPropertyDef(data: unknown) {
  const parsed = propertyDefSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { name, valueType, unit } = parsed.data;
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const maxSort = await safeDb(
    prisma.inventoryPropertyDef.aggregate({ _max: { sortOrder: true } })
  );
  const sortOrder = maxSort.isOk() ? (maxSort.value._max.sortOrder ?? -1) + 1 : 0;

  const result = await safeDb(
    prisma.inventoryPropertyDef.create({
      data: { name, slug, valueType, unit: unit || null, sortOrder },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/inventory");
  return { success: true, id: result.value.id };
}

export async function deletePropertyDef(id: string) {
  // Check if in use
  const countResult = await safeDb(
    prisma.inventoryItemProperty.count({ where: { propertyDefId: id } })
  );
  if (countResult.isErr()) return { error: countResult.error };
  if (countResult.value > 0) {
    return { error: `Cannot delete: property is set on ${countResult.value} item(s).` };
  }

  const result = await safeDb(prisma.inventoryPropertyDef.delete({ where: { id } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

// ─── Item Properties ──────────────────────────────────────────────────────────

export async function upsertItemProperty(
  inventoryItemId: string,
  propertyDefId: string,
  value: { text?: string; numeric?: number | null; boolean?: boolean | null }
) {
  const result = await safeDb(
    prisma.inventoryItemProperty.upsert({
      where: { inventoryItemId_propertyDefId: { inventoryItemId, propertyDefId } },
      create: {
        inventoryItemId,
        propertyDefId,
        textValue: value.text ?? null,
        numericValue: value.numeric ?? null,
        booleanValue: value.boolean ?? null,
      },
      update: {
        textValue: value.text ?? null,
        numericValue: value.numeric ?? null,
        booleanValue: value.boolean ?? null,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  return { success: true };
}

export async function deleteItemProperty(
  inventoryItemId: string,
  propertyDefId: string
) {
  const result = await safeDb(
    prisma.inventoryItemProperty.delete({
      where: { inventoryItemId_propertyDefId: { inventoryItemId, propertyDefId } },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  return { success: true };
}
