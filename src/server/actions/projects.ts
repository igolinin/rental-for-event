"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateRefCode } from "@/lib/utils";
import { auth } from "@/lib/auth";
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
  if (!session?.user) return { error: "Not authenticated." };

  const parsed = projectSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const refCode = generateRefCode("PRJ");

  const project = await prisma.project.create({
    data: {
      refCode,
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
      createdById: session.user.id,
    },
  });

  revalidatePath("/dashboard/projects");
  return { success: true, id: project.id };
}

export async function updateProject(id: string, data: unknown) {
  const parsed = projectSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  await prisma.project.update({
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
  });

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${id}`);
  return { success: true };
}

export async function deleteProject(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    select: { status: true, _count: { select: { invoices: true } } },
  });

  if (!project) return { error: "Project not found." };
  if (project.status !== "INQUIRY") {
    return { error: "Only projects in Inquiry status can be deleted." };
  }
  if (project._count.invoices > 0) {
    return { error: "Cannot delete: project has invoices. Void them first." };
  }

  await prisma.project.delete({ where: { id } });
  revalidatePath("/dashboard/projects");
  return { success: true };
}

export async function updateProjectStatus(
  id: string,
  status: "INQUIRY" | "QUOTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
) {
  await prisma.project.update({ where: { id }, data: { status } });
  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${id}`);
  return { success: true };
}

// ─── Kit List (Equipment Items) ───────────────────────────────────────────────

export async function addEquipmentItem(projectId: string, data: unknown) {
  const parsed = equipmentItemSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  // Fetch project dates for availability check
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { startAt: true, endAt: true },
  });
  if (!project) return { error: "Project not found." };

  // Availability check
  const available = await getAvailableQuantity(
    d.inventoryItemId,
    project.startAt,
    project.endAt,
    projectId
  );

  if (available < d.quantityNeeded) {
    return {
      error: `Only ${available} unit(s) available for that date range.`,
    };
  }

  // Get current max sortOrder
  const maxSort = await prisma.projectEquipmentItem.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  await prisma.projectEquipmentItem.create({
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
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function removeEquipmentItem(lineItemId: string, projectId: string) {
  await prisma.projectEquipmentItem.delete({ where: { id: lineItemId } });
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function updateEquipmentItem(
  lineItemId: string,
  projectId: string,
  data: unknown
) {
  const parsed = equipmentItemSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  // Availability check (excluding this project's own line)
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { startAt: true, endAt: true },
  });
  if (!project) return { error: "Project not found." };

  const available = await getAvailableQuantity(
    d.inventoryItemId,
    project.startAt,
    project.endAt,
    projectId
  );

  if (available < d.quantityNeeded) {
    return {
      error: `Only ${available} unit(s) available for that date range.`,
    };
  }

  await prisma.projectEquipmentItem.update({
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
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

// ─── Project Expenses ─────────────────────────────────────────────────────────

export async function addProjectExpense(projectId: string, data: unknown) {
  const parsed = projectExpenseSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  await prisma.projectExpense.create({
    data: {
      projectId,
      description: d.description,
      category: d.category,
      amount: d.amount,
      currency: d.currency,
      date: new Date(d.date),
      notes: d.notes,
    },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function deleteProjectExpense(expenseId: string, projectId: string) {
  await prisma.projectExpense.delete({ where: { id: expenseId } });
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

// ─── Sub-Rentals ──────────────────────────────────────────────────────────────

export async function createSubRental(projectId: string, data: unknown) {
  const parsed = subRentalSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const subRental = await prisma.subRental.create({
    data: {
      projectId,
      vendorName: d.vendorName,
      vendorContact: d.vendorContact,
      vendorEmail: d.vendorEmail || null,
      startAt: new Date(d.startAt),
      endAt: new Date(d.endAt),
      notes: d.notes,
    },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true, id: subRental.id };
}

export async function updateSubRentalStatus(
  subRentalId: string,
  projectId: string,
  status: "REQUESTED" | "CONFIRMED" | "RECEIVED" | "RETURNED" | "CANCELLED"
) {
  await prisma.subRental.update({ where: { id: subRentalId }, data: { status } });
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function addSubRentalItem(subRentalId: string, projectId: string, data: unknown) {
  const parsed = subRentalItemSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  await prisma.subRentalItem.create({
    data: {
      subRentalId,
      description: d.description,
      quantity: d.quantity,
      unitRateAmount: d.unitRateAmount,
      unitRateCurrency: d.unitRateCurrency,
      rateType: d.rateType,
      rateDays: d.rateDays,
    },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function removeSubRentalItem(itemId: string, projectId: string) {
  await prisma.subRentalItem.delete({ where: { id: itemId } });
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

// ─── Serialized Unit Allocation ───────────────────────────────────────────────

export async function fetchSerializedUnitsForKitItem(kitItemId: string) {
  const kitItem = await prisma.projectEquipmentItem.findUnique({
    where: { id: kitItemId },
    include: {
      inventoryItem: {
        include: { serializedUnits: { orderBy: { serialNumber: "asc" } } },
      },
      allocations: { select: { serializedUnitId: true } },
      project: { select: { id: true, startAt: true, endAt: true } },
    },
  });

  if (!kitItem) return { error: "Kit item not found." };

  const { id: projectId, startAt, endAt } = kitItem.project;
  const currentIds = new Set(kitItem.allocations.map((a) => a.serializedUnitId));
  const allUnitIds = kitItem.inventoryItem.serializedUnits.map((u) => u.id);

  const conflicts = await prisma.projectEquipmentAllocation.findMany({
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
  });
  const conflictSet = new Set(conflicts.map((c) => c.serializedUnitId));

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
  await prisma.projectEquipmentAllocation.deleteMany({
    where: { projectEquipmentItemId: kitItemId },
  });

  if (unitIds.length > 0) {
    await prisma.projectEquipmentAllocation.createMany({
      data: unitIds.map((unitId) => ({
        projectEquipmentItemId: kitItemId,
        serializedUnitId: unitId,
      })),
    });
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}
