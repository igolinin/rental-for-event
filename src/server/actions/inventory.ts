"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, diffObjects } from "@/lib/audit";
import { generateRefCode, generateShortCode } from "@/lib/utils";
import {
  categorySchema,
  subCategorySchema,
  inventoryItemSchema,
  serializedUnitSchema,
  maintenanceLogSchema,
  propertyDefSchema,
} from "@/schemas/inventory";

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function getSession() {
  const session = await auth();
  if (!session?.user) return null;
  return session;
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function createCategory(data: unknown) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "CREATE");
  if (denied) return denied;

  const parsed = categorySchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { name, description, color, sortOrder } = parsed.data;
  const result = await safeDb(
    prisma.inventoryCategory.create({ data: { name, slug: slugify(name), description, color, sortOrder } })
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "InventoryCategory", entityId: result.value.id, entityLabel: name, action: "CREATE", userId: session!.user.id });
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/categories");
  return { success: true };
}

export async function updateCategory(id: string, data: unknown) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "UPDATE");
  if (denied) return denied;

  const parsed = categorySchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { name, description, color, sortOrder } = parsed.data;
  const result = await safeDb(
    prisma.inventoryCategory.update({ where: { id }, data: { name, slug: slugify(name), description, color, sortOrder } })
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "InventoryCategory", entityId: id, entityLabel: name, action: "UPDATE", userId: session!.user.id });
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/categories");
  return { success: true };
}

export async function deleteCategory(id: string) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "DELETE");
  if (denied) return denied;

  const countResult = await safeDb(prisma.inventoryItem.count({ where: { categoryId: id } }));
  if (countResult.isErr()) return { error: countResult.error };
  if (countResult.value > 0) return { error: "Cannot delete category with existing items." };

  const cat = await prisma.inventoryCategory.findUnique({ where: { id }, select: { name: true } });
  const result = await safeDb(
    prisma.$transaction([
      prisma.inventorySubCategory.deleteMany({ where: { categoryId: id } }),
      prisma.inventoryCategory.delete({ where: { id } }),
    ])
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "InventoryCategory", entityId: id, entityLabel: cat?.name, action: "DELETE", userId: session!.user.id });
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/categories");
  return { success: true };
}

export async function createSubCategory(data: unknown) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "CREATE");
  if (denied) return denied;

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
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "DELETE");
  if (denied) return denied;

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
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "CREATE");
  if (denied) return denied;

  const parsed = inventoryItemSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  // Price field requires elevated INVENTORY_PRICING permission
  if (d.dailyRateAmount || d.replacementCostAmount) {
    const priceDenied = await requirePermission(session, "INVENTORY_PRICING", "MANAGE");
    if (priceDenied) return { error: "Setting prices requires elevated permissions." };
  }

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
        pricingProfileId: d.pricingProfileId || null,
        notes: d.notes,
        isActive: d.isActive,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "InventoryItem", entityId: result.value.id, entityLabel: d.name, action: "CREATE", userId: session!.user.id });
  revalidatePath("/dashboard/inventory");
  return { success: true, id: result.value.id };
}

export async function updateInventoryItem(id: string, data: unknown) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "UPDATE");
  if (denied) return denied;

  const parsed = inventoryItemSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  // Fetch before snapshot for diff
  const before = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!before) return { error: "Item not found." };

  // Detect price changes — require elevated permission
  const priceChanging =
    (d.dailyRateAmount ?? null) !== before.dailyRateAmount ||
    (d.replacementCostAmount ?? null) !== before.replacementCostAmount;
  if (priceChanging) {
    const priceDenied = await requirePermission(session, "INVENTORY_PRICING", "MANAGE");
    if (priceDenied) return { error: "Changing prices requires elevated permissions." };
  }

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
        pricingProfileId: d.pricingProfileId || null,
        notes: d.notes,
        isActive: d.isActive,
      },
    })
  );
  if (result.isErr()) return { error: result.error };

  const changes = diffObjects(
    before as Record<string, unknown>,
    d as unknown as Record<string, unknown>,
    ["name", "description", "categoryId", "trackingMode", "totalQuantity",
     "dailyRateAmount", "dailyRateCurrency", "replacementCostAmount", "replacementCostCurrency",
     "notes", "isActive"]
  );
  if (Object.keys(changes).length > 0) {
    await logAudit({
      entityType: "InventoryItem",
      entityId: id,
      entityLabel: before.name,
      action: priceChanging ? "UPDATE" : "UPDATE",
      userId: session!.user.id,
      changes,
    });
  }
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/dashboard/inventory/${id}`);
  return { success: true };
}

export async function archiveInventoryItem(id: string) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "DELETE");
  if (denied) return denied;

  const item = await prisma.inventoryItem.findUnique({ where: { id }, select: { name: true, isActive: true } });
  const result = await safeDb(
    prisma.inventoryItem.update({ where: { id }, data: { isActive: false } })
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "InventoryItem", entityId: id, entityLabel: item?.name, action: "STATUS_CHANGE", userId: session!.user.id, changes: { isActive: { from: true, to: false } } });
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

// ─── Serialized Units ─────────────────────────────────────────────────────────

export async function addSerializedUnit(inventoryItemId: string, data: unknown) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "CREATE");
  if (denied) return denied;

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
  await logAudit({ entityType: "SerializedUnit", entityId: result.value.id, entityLabel: d.serialNumber, action: "CREATE", userId: session!.user.id, meta: { inventoryItemId } });
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  return { success: true };
}

export async function updateSerializedUnit(unitId: string, inventoryItemId: string, data: unknown) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "UPDATE");
  if (denied) return denied;

  const parsed = serializedUnitSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const before = await prisma.serializedUnit.findUnique({ where: { id: unitId } });
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

  if (before) {
    const changes = diffObjects(
      before as Record<string, unknown>,
      d as unknown as Record<string, unknown>,
      ["serialNumber", "assetTag", "status", "warehouseId", "purchasePriceAmount"]
    );
    if (Object.keys(changes).length > 0) {
      await logAudit({ entityType: "SerializedUnit", entityId: unitId, entityLabel: before.serialNumber, action: "UPDATE", userId: session!.user.id, changes });
    }
  }
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  return { success: true };
}

export async function deleteSerializedUnit(unitId: string, inventoryItemId: string) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "DELETE");
  if (denied) return denied;

  const allocResult = await safeDb(
    prisma.projectEquipmentAllocation.count({ where: { serializedUnitId: unitId } })
  );
  if (allocResult.isErr()) return { error: allocResult.error };
  if (allocResult.value > 0) return { error: "Cannot delete unit that has project allocations." };

  const unit = await prisma.serializedUnit.findUnique({ where: { id: unitId }, select: { serialNumber: true } });
  const result = await safeDb(prisma.serializedUnit.delete({ where: { id: unitId } }));
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "SerializedUnit", entityId: unitId, entityLabel: unit?.serialNumber, action: "DELETE", userId: session!.user.id, meta: { inventoryItemId } });
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
        await tx.serializedUnit.update({ where: { id: log.serializedUnitId }, data: { status: "IN_REPAIR" } });
      }
      return log;
    })
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "MaintenanceLog", entityId: result.value.id, action: "CREATE", userId: session.user.id, meta: { inventoryItemId: d.inventoryItemId, type: d.type } });
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
          await tx.serializedUnit.update({ where: { id: log.serializedUnitId }, data: { status: "AVAILABLE" } });
        } else {
          await tx.serializedUnit.update({ where: { id: log.serializedUnitId }, data: { status: "IN_REPAIR" } });
        }
      }
      return log;
    })
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "MaintenanceLog", entityId: logId, action: "STATUS_CHANGE", userId: session.user.id, changes: { status: { from: null, to: status } } });
  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

// ─── Item Images ──────────────────────────────────────────────────────────────

export async function addInventoryImage(inventoryItemId: string, url: string, caption?: string) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "UPDATE");
  if (denied) return denied;

  const existingCount = await safeDb(prisma.inventoryItemImage.count({ where: { inventoryItemId } }));
  const isPrimary = existingCount.isOk() && existingCount.value === 0;
  const maxSort = await safeDb(prisma.inventoryItemImage.aggregate({ where: { inventoryItemId }, _max: { sortOrder: true } }));
  const sortOrder = maxSort.isOk() ? (maxSort.value._max.sortOrder ?? -1) + 1 : 0;

  const result = await safeDb(
    prisma.inventoryItemImage.create({ data: { inventoryItemId, url, caption: caption || null, sortOrder, isPrimary } })
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "InventoryItemImage", entityId: result.value.id, action: "CREATE", userId: session!.user.id, meta: { inventoryItemId, url } });
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  revalidatePath("/dashboard/inventory");
  return { success: true, id: result.value.id };
}

export async function deleteInventoryImage(imageId: string, inventoryItemId: string) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "UPDATE");
  if (denied) return denied;

  const imgResult = await safeDb(prisma.inventoryItemImage.findUnique({ where: { id: imageId } }));
  if (imgResult.isErr()) return { error: imgResult.error };
  const wasPrimary = imgResult.value?.isPrimary ?? false;

  const result = await safeDb(prisma.inventoryItemImage.delete({ where: { id: imageId } }));
  if (result.isErr()) return { error: result.error };

  if (wasPrimary) {
    const next = await prisma.inventoryItemImage.findFirst({ where: { inventoryItemId }, orderBy: { sortOrder: "asc" } });
    if (next) await prisma.inventoryItemImage.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function setPrimaryImage(imageId: string, inventoryItemId: string) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "UPDATE");
  if (denied) return denied;

  const result = await safeDb(prisma.$transaction([
    prisma.inventoryItemImage.updateMany({ where: { inventoryItemId }, data: { isPrimary: false } }),
    prisma.inventoryItemImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
  ]));
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function updateImageCaption(imageId: string, inventoryItemId: string, caption: string) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "UPDATE");
  if (denied) return denied;

  const result = await safeDb(prisma.inventoryItemImage.update({ where: { id: imageId }, data: { caption: caption || null } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  return { success: true };
}

// ─── Property Definitions ─────────────────────────────────────────────────────

export async function createPropertyDef(data: unknown) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "MANAGE");
  if (denied) return denied;

  const parsed = propertyDefSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { name, valueType, unit } = parsed.data;
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const maxSort = await safeDb(prisma.inventoryPropertyDef.aggregate({ _max: { sortOrder: true } }));
  const sortOrder = maxSort.isOk() ? (maxSort.value._max.sortOrder ?? -1) + 1 : 0;

  const result = await safeDb(prisma.inventoryPropertyDef.create({ data: { name, slug, valueType, unit: unit || null, sortOrder } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/inventory");
  return { success: true, id: result.value.id };
}

export async function deletePropertyDef(id: string) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "MANAGE");
  if (denied) return denied;

  const countResult = await safeDb(prisma.inventoryItemProperty.count({ where: { propertyDefId: id } }));
  if (countResult.isErr()) return { error: countResult.error };
  if (countResult.value > 0) return { error: `Cannot delete: property is set on ${countResult.value} item(s).` };

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
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "UPDATE");
  if (denied) return denied;

  const result = await safeDb(
    prisma.inventoryItemProperty.upsert({
      where: { inventoryItemId_propertyDefId: { inventoryItemId, propertyDefId } },
      create: { inventoryItemId, propertyDefId, textValue: value.text ?? null, numericValue: value.numeric ?? null, booleanValue: value.boolean ?? null },
      update: { textValue: value.text ?? null, numericValue: value.numeric ?? null, booleanValue: value.boolean ?? null },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  return { success: true };
}

export async function deleteItemProperty(inventoryItemId: string, propertyDefId: string) {
  const session = await getSession();
  const denied = await requirePermission(session, "INVENTORY", "UPDATE");
  if (denied) return denied;

  const result = await safeDb(
    prisma.inventoryItemProperty.delete({ where: { inventoryItemId_propertyDefId: { inventoryItemId, propertyDefId } } })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/inventory/${inventoryItemId}`);
  return { success: true };
}
