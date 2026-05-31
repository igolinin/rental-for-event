"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeDb } from "@/lib/db";
import { generateRefCode } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { getAvailableQuantity } from "@/lib/availability";
import {
  projectSchema,
  equipmentItemSchema,
  projectExpenseSchema,
  subRentalSchema,
  subRentalItemSchema,
} from "@/schemas/projects";

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function createProject(data: unknown) {
  const session = await auth();
  const denied = await requirePermission(session, "PROJECTS", "CREATE");
  if (denied) return denied;

  const parsed = projectSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const result = await safeDb(
    prisma.project.create({
      data: {
        refCode: generateRefCode("PRJ"),
        name: d.name,
        type: d.type,
        status: d.status,
        clientId: d.clientId,
        venue: d.venue,
        city: d.city,
        country: d.country,
        loadInAt: d.loadInAt ? new Date(d.loadInAt) : null,
        startAt: new Date(d.startAt),
        endAt: new Date(d.endAt),
        loadOutAt: d.loadOutAt ? new Date(d.loadOutAt) : null,
        currencyCode: d.currencyCode,
        taxRate: d.taxRate,
        depositAmount: d.depositAmount,
        notes: d.notes,
        internalNotes: d.internalNotes,
        createdById: session!.user!.id,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "Project", entityId: result.value.id, entityLabel: d.name, action: "CREATE", userId: session?.user?.id });
  revalidatePath("/dashboard/projects");
  return { success: true, id: result.value.id };
}

export async function updateProject(id: string, data: unknown) {
  const session = await auth();
  const denied = await requirePermission(session, "PROJECTS", "UPDATE");
  if (denied) return denied;

  const parsed = projectSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const result = await safeDb(
    prisma.project.update({
      where: { id },
      data: {
        name: d.name,
        type: d.type,
        status: d.status,
        clientId: d.clientId,
        venue: d.venue,
        city: d.city,
        country: d.country,
        loadInAt: d.loadInAt ? new Date(d.loadInAt) : null,
        startAt: new Date(d.startAt),
        endAt: new Date(d.endAt),
        loadOutAt: d.loadOutAt ? new Date(d.loadOutAt) : null,
        currencyCode: d.currencyCode,
        taxRate: d.taxRate,
        depositAmount: d.depositAmount,
        notes: d.notes,
        internalNotes: d.internalNotes,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "Project", entityId: id, action: "UPDATE", userId: session?.user?.id });
  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${id}`);
  return { success: true };
}

// Projects are never hard-deleted. Use updateProjectStatus to CANCELLED/ARCHIVED instead.

// ─── Status transition machine ────────────────────────────────────────────────

type ProjectStatus = "INQUIRY" | "QUOTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "ARCHIVED";

const ALLOWED_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  INQUIRY:     ["QUOTED", "CANCELLED"],
  QUOTED:      ["CONFIRMED", "INQUIRY", "CANCELLED"],
  CONFIRMED:   ["IN_PROGRESS", "QUOTED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CONFIRMED"],
  COMPLETED:   ["ARCHIVED"],
  CANCELLED:   [],
  ARCHIVED:    [],
};

export async function updateProjectStatus(id: string, status: ProjectStatus) {
  const session = await auth();
  const denied = await requirePermission(session, "PROJECTS", "UPDATE");
  if (denied) return denied;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      status: true,
      name: true,
      _count: { select: { invoices: true } },
      invoices: { where: { status: { notIn: ["DRAFT", "VOID"] } }, select: { id: true } },
    },
  });
  if (!project) return { error: "Project not found." };

  const from = project.status as ProjectStatus;
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];

  // Only ADMIN can use transitions not in the default list (reverting, etc.)
  if (!allowed.includes(status) && session?.user?.role !== "ADMIN") {
    return { error: `Cannot transition from ${from} to ${status}.` };
  }

  // Cancelling a project with active invoices requires ADMIN
  if (status === "CANCELLED" && project.invoices.length > 0 && session?.user?.role !== "ADMIN") {
    return { error: "Cannot cancel a project with active invoices. An admin must approve this." };
  }

  const result = await safeDb(prisma.project.update({ where: { id }, data: { status } }));
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "Project", entityId: id, entityLabel: project.name, action: "STATUS_CHANGE", userId: session?.user?.id, changes: { status: { from, to: status } } });
  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${id}`);
  return { success: true };
}

// ─── Availability check (called live from kit list form) ─────────────────────

export async function checkItemAvailability(
  inventoryItemId: string,
  projectId: string
): Promise<{ available: number; error?: string }> {
  const projectResult = await safeDb(
    prisma.project.findUnique({
      where: { id: projectId },
      select: { startAt: true, endAt: true },
    })
  );
  if (projectResult.isErr()) return { available: 0, error: projectResult.error };
  if (!projectResult.value) return { available: 0, error: "Project not found." };
  const available = await getAvailableQuantity(
    inventoryItemId,
    projectResult.value.startAt,
    projectResult.value.endAt,
    projectId
  );
  return { available };
}

// ─── Kit List (Equipment Items) ───────────────────────────────────────────────

export async function addEquipmentItem(projectId: string, data: unknown) {
  const session = await auth();
  const denied = await requirePermission(session, "PROJECTS", "UPDATE");
  if (denied) return denied;

  const parsed = equipmentItemSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const projectResult = await safeDb(
    prisma.project.findUnique({ where: { id: projectId }, select: { startAt: true, endAt: true, name: true } })
  );
  if (projectResult.isErr()) return { error: projectResult.error };
  if (!projectResult.value) return { error: "Project not found." };

  const available = await getAvailableQuantity(
    d.inventoryItemId,
    projectResult.value.startAt,
    projectResult.value.endAt,
    projectId
  );
  if (available < d.quantityNeeded) {
    // Log the conflict attempt so it's traceable
    await logAudit({
      entityType: "InventoryItem",
      entityId: d.inventoryItemId,
      action: "ALLOCATION",
      userId: session?.user?.id,
      changes: { availability: { from: available, to: "CONFLICT" } },
      meta: { projectId, projectName: projectResult.value.name, requestedQty: d.quantityNeeded, availableQty: available },
    });
    return { error: `Only ${available} unit(s) available for that date range.` };
  }

  const maxSortResult = await safeDb(
    prisma.projectEquipmentItem.aggregate({ where: { projectId }, _max: { sortOrder: true } })
  );
  if (maxSortResult.isErr()) return { error: maxSortResult.error };
  const sortOrder = (maxSortResult.value._max.sortOrder ?? -1) + 1;

  const result = await safeDb(
    prisma.projectEquipmentItem.create({
      data: {
        projectId,
        inventoryItemId: d.inventoryItemId,
        quantityNeeded: d.quantityNeeded,
        unitRateAmount: d.unitRateAmount,
        unitRateCurrency: d.unitRateCurrency,
        rateType: d.rateType,
        rateDays: d.rateDays,
        description: d.description,
        notes: d.notes,
        sortOrder,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({
    entityType: "InventoryItem",
    entityId: d.inventoryItemId,
    action: "ALLOCATION",
    userId: session?.user?.id,
    meta: { projectId, projectName: projectResult.value.name, quantityNeeded: d.quantityNeeded, kitItemId: result.value.id },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function removeEquipmentItem(lineItemId: string, projectId: string) {
  const result = await safeDb(
    prisma.projectEquipmentItem.delete({ where: { id: lineItemId } })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function updateEquipmentItem(lineItemId: string, projectId: string, data: unknown) {
  const parsed = equipmentItemSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const projectResult = await safeDb(
    prisma.project.findUnique({ where: { id: projectId }, select: { startAt: true, endAt: true } })
  );
  if (projectResult.isErr()) return { error: projectResult.error };
  if (!projectResult.value) return { error: "Project not found." };

  const available = await getAvailableQuantity(
    d.inventoryItemId,
    projectResult.value.startAt,
    projectResult.value.endAt,
    projectId
  );
  if (available < d.quantityNeeded) {
    return { error: `Only ${available} unit(s) available for that date range.` };
  }

  const result = await safeDb(
    prisma.projectEquipmentItem.update({
      where: { id: lineItemId },
      data: {
        quantityNeeded: d.quantityNeeded,
        unitRateAmount: d.unitRateAmount,
        unitRateCurrency: d.unitRateCurrency,
        rateType: d.rateType,
        rateDays: d.rateDays,
        description: d.description,
        notes: d.notes,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

// ─── Project Expenses ─────────────────────────────────────────────────────────

export async function addProjectExpense(projectId: string, data: unknown) {
  const parsed = projectExpenseSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const result = await safeDb(
    prisma.projectExpense.create({
      data: {
        projectId,
        description: d.description,
        category: d.category,
        amount: d.amount,
        currency: d.currency,
        date: new Date(d.date),
        notes: d.notes,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function deleteProjectExpense(expenseId: string, projectId: string) {
  const result = await safeDb(prisma.projectExpense.delete({ where: { id: expenseId } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

// ─── Sub-Rentals ──────────────────────────────────────────────────────────────

export async function createSubRental(projectId: string, data: unknown) {
  const parsed = subRentalSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const result = await safeDb(
    prisma.subRental.create({
      data: {
        projectId,
        vendorName: d.vendorName,
        vendorContact: d.vendorContact,
        vendorEmail: d.vendorEmail || null,
        startAt: new Date(d.startAt),
        endAt: new Date(d.endAt),
        notes: d.notes,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true, id: result.value.id };
}

export async function updateSubRentalStatus(
  subRentalId: string,
  projectId: string,
  status: "REQUESTED" | "CONFIRMED" | "RECEIVED" | "RETURNED" | "CANCELLED"
) {
  const result = await safeDb(
    prisma.subRental.update({ where: { id: subRentalId }, data: { status } })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function addSubRentalItem(subRentalId: string, projectId: string, data: unknown) {
  const parsed = subRentalItemSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const result = await safeDb(
    prisma.subRentalItem.create({
      data: {
        subRentalId,
        description: d.description,
        quantity: d.quantity,
        unitRateAmount: d.unitRateAmount,
        unitRateCurrency: d.unitRateCurrency,
        rateType: d.rateType,
        rateDays: d.rateDays,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function removeSubRentalItem(itemId: string, projectId: string) {
  const result = await safeDb(prisma.subRentalItem.delete({ where: { id: itemId } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

// ─── Serialized Unit Allocation ───────────────────────────────────────────────

export async function fetchSerializedUnitsForKitItem(kitItemId: string) {
  const kitItem = await prisma.projectEquipmentItem.findUnique({
    where: { id: kitItemId },
    include: {
      inventoryItem: { include: { serializedUnits: { orderBy: { serialNumber: "asc" } } } },
      allocations: { select: { serializedUnitId: true } },
      project: { select: { id: true, startAt: true, endAt: true } },
    },
  });

  if (!kitItem) return { error: "Kit item not found." };

  const { id: projectId, startAt, endAt } = kitItem.project;
  const currentIds = new Set(kitItem.allocations.map((a) => a.serializedUnitId));
  const allUnitIds = kitItem.inventoryItem.serializedUnits.map((u) => u.id);

  const conflictsResult = await safeDb(
    prisma.projectEquipmentAllocation.findMany({
      where: {
        serializedUnitId: { in: allUnitIds },
        projectEquipmentItem: {
          project: {
            id: { not: projectId },
            startAt: { lte: endAt },
            endAt: { gte: startAt },
            status: { notIn: ["CANCELLED", "COMPLETED"] },
          },
        },
      },
      select: { serializedUnitId: true },
    })
  );
  if (conflictsResult.isErr()) return { error: conflictsResult.error };
  const conflictSet = new Set(conflictsResult.value.map((c) => c.serializedUnitId));

  return {
    units: kitItem.inventoryItem.serializedUnits.map((unit) => ({
      id: unit.id,
      serialNumber: unit.serialNumber,
      assetTag: unit.assetTag,
      status: unit.status as string,
      isAssignedToThisItem: currentIds.has(unit.id),
      isAvailable:
        (unit.status === "AVAILABLE" || unit.status === "IN_SERVICE") &&
        !conflictSet.has(unit.id),
    })),
  };
}

export async function updateEquipmentAllocation(
  kitItemId: string,
  unitIds: string[],
  projectId: string
) {
  const result = await safeDb(
    prisma.$transaction(async (tx) => {
      await tx.projectEquipmentAllocation.deleteMany({ where: { projectEquipmentItemId: kitItemId } });
      if (unitIds.length > 0) {
        await tx.projectEquipmentAllocation.createMany({
          data: unitIds.map((unitId) => ({ projectEquipmentItemId: kitItemId, serializedUnitId: unitId })),
        });
      }
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}
