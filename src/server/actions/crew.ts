"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeDb } from "@/lib/db";
import { generateShortCode } from "@/lib/utils";
import { auth } from "@/lib/auth";
import {
  crewMemberSchema,
  crewRateSchema,
  crewAssignmentSchema,
  timesheetSchema,
  crewExpenseSchema,
} from "@/schemas/crew";
import { calculateShiftOT, calculateShiftTotal, DEFAULT_OT_POLICY } from "@/lib/payroll";
import { getActiveCrewRates } from "@/server/queries/crew";

// ─── Crew Members ─────────────────────────────────────────────────────────────

export async function createCrewMember(data: unknown) {
  const parsed = crewMemberSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const refCode = generateShortCode("CRW");

  const result = await safeDb(
    prisma.crewMember.create({
      data: {
        refCode,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email || null,
        phone: d.phone,
        type: d.type,
        role: d.role,
        taxId: d.taxId,
        emergencyContact: d.emergencyContact,
        notes: d.notes,
        isActive: d.isActive,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/crew");
  return { success: true, id: result.value.id };
}

export async function updateCrewMember(id: string, data: unknown) {
  const parsed = crewMemberSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const result = await safeDb(
    prisma.crewMember.update({
      where: { id },
      data: {
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email || null,
        phone: d.phone,
        type: d.type,
        role: d.role,
        taxId: d.taxId,
        emergencyContact: d.emergencyContact,
        notes: d.notes,
        isActive: d.isActive,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/crew");
  revalidatePath(`/dashboard/crew/${id}`);
  return { success: true };
}

// ─── Crew Rates ───────────────────────────────────────────────────────────────

export async function addCrewRate(crewMemberId: string, data: unknown) {
  const parsed = crewRateSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const result = await safeDb(
    prisma.crewRate.create({
      data: {
        crewMemberId,
        rateType: d.rateType,
        amount: d.amount,
        currency: d.currency,
        effectiveFrom: new Date(d.effectiveFrom),
        effectiveTo: d.effectiveTo ? new Date(d.effectiveTo) : null,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/crew/${crewMemberId}`);
  return { success: true };
}

export async function deleteCrewRate(rateId: string, crewMemberId: string) {
  const result = await safeDb(prisma.crewRate.delete({ where: { id: rateId } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/crew/${crewMemberId}`);
  return { success: true };
}

// ─── Crew Assignments ─────────────────────────────────────────────────────────

export async function createCrewAssignment(projectId: string, data: unknown) {
  const parsed = crewAssignmentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const startAt = new Date(d.startAt);
  const endAt = new Date(d.endAt);

  const conflictResult = await safeDb(
    prisma.crewAssignment.findFirst({
      where: {
        crewMemberId: d.crewMemberId,
        projectId: { not: projectId },
        startAt: { lte: endAt },
        endAt: { gte: startAt },
      },
      include: { project: { select: { name: true } } },
    })
  );
  if (conflictResult.isErr()) return { error: conflictResult.error };
  if (conflictResult.value) {
    return {
      error: `Crew member is already assigned to "${conflictResult.value.project.name}" during this period.`,
    };
  }

  const result = await safeDb(
    prisma.crewAssignment.create({
      data: {
        projectId,
        crewMemberId: d.crewMemberId,
        phaseId: d.phaseId || null,
        role: d.role,
        startAt,
        endAt,
        notes: d.notes,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/crew");
  return { success: true };
}

export async function checkCrewMemberConflict(
  crewMemberId: string,
  startAt: string,
  endAt: string,
  excludeProjectId: string
): Promise<{ conflict: { projectName: string } | null }> {
  const result = await safeDb(
    prisma.crewAssignment.findFirst({
      where: {
        crewMemberId,
        projectId: { not: excludeProjectId },
        startAt: { lte: new Date(endAt) },
        endAt: { gte: new Date(startAt) },
      },
      include: { project: { select: { name: true } } },
    })
  );
  if (result.isErr() || !result.value) return { conflict: null };
  return { conflict: { projectName: result.value.project.name } };
}

export async function deleteCrewAssignment(assignmentId: string, projectId: string) {
  const result = await safeDb(prisma.crewAssignment.delete({ where: { id: assignmentId } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

// ─── Timesheets ───────────────────────────────────────────────────────────────

export async function createTimesheet(projectId: string, data: unknown) {
  const parsed = timesheetSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const result = await safeDb(
    prisma.timesheet.create({
      data: {
        projectId,
        crewMemberId: d.crewMemberId,
        crewAssignmentId: d.crewAssignmentId || null,
        clockIn: new Date(d.clockIn),
        clockOut: new Date(d.clockOut),
        breakMinutes: d.breakMinutes,
        timeType: d.timeType,
        notes: d.notes,
        status: "DRAFT",
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/timesheets");
  return { success: true };
}

export async function submitTimesheet(timesheetId: string) {
  const result = await safeDb(
    prisma.timesheet.update({ where: { id: timesheetId }, data: { status: "SUBMITTED" } })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/timesheets");
  return { success: true };
}

export async function approveTimesheet(timesheetId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated." };

  const tsResult = await safeDb(
    prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: { crewMember: { include: { rates: true } } },
    })
  );
  if (tsResult.isErr()) return { error: tsResult.error };
  const ts = tsResult.value;
  if (!ts) return { error: "Timesheet not found." };
  if (!ts.clockOut) return { error: "Timesheet has no clock-out time." };

  const settingsResult = await safeDb(
    prisma.systemSettings.findUnique({
      where: { id: "singleton" },
      select: { otDailyThreshold: true, otWeeklyThreshold: true },
    })
  );
  if (settingsResult.isErr()) return { error: settingsResult.error };
  const settings = settingsResult.value;

  const policy = {
    dailyOTThreshold: settings?.otDailyThreshold ?? DEFAULT_OT_POLICY.dailyOTThreshold,
    dailyDTThreshold: (settings?.otDailyThreshold ?? DEFAULT_OT_POLICY.dailyOTThreshold) * 1.5,
    weeklyOTThreshold: settings?.otWeeklyThreshold ?? DEFAULT_OT_POLICY.weeklyOTThreshold,
  };

  const otResult = calculateShiftOT(
    { id: ts.id, clockIn: ts.clockIn, clockOut: ts.clockOut, breakMinutes: ts.breakMinutes },
    policy
  );

  const rates = await getActiveCrewRates(ts.crewMemberId);
  const find = (type: string) => rates.find((r) => r.rateType === type)?.amount ?? 0;

  const regularRate = find("REGULAR");
  const overtimeRate = find("OVERTIME") || regularRate * 1.5;
  const doubleTimeRate = find("DOUBLE_TIME") || regularRate * 2;

  const totalAmount =
    ts.timeType === "WORK"
      ? calculateShiftTotal(otResult, regularRate, overtimeRate, doubleTimeRate)
      : ts.timeType === "PER_DIEM"
      ? find("PER_DIEM")
      : find("TRAVEL_DAY");

  const updateResult = await safeDb(
    prisma.timesheet.update({
      where: { id: timesheetId },
      data: {
        status: "APPROVED",
        regularHours: otResult.regularHours,
        overtimeHours: otResult.overtimeHours,
        doubleTimeHours: otResult.doubleTimeHours,
        regularRateAmount: regularRate,
        overtimeRateAmount: overtimeRate,
        doubleTimeRateAmount: doubleTimeRate,
        totalAmount,
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    })
  );
  if (updateResult.isErr()) return { error: updateResult.error };
  revalidatePath("/dashboard/timesheets");
  revalidatePath(`/dashboard/projects/${ts.projectId}`);
  return { success: true };
}

export async function rejectTimesheet(timesheetId: string) {
  const result = await safeDb(
    prisma.timesheet.update({ where: { id: timesheetId }, data: { status: "REJECTED" } })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/timesheets");
  return { success: true };
}

export async function deleteTimesheet(timesheetId: string) {
  const tsResult = await safeDb(
    prisma.timesheet.findUnique({
      where: { id: timesheetId },
      select: { projectId: true, status: true },
    })
  );
  if (tsResult.isErr()) return { error: tsResult.error };
  if (!tsResult.value) return { error: "Not found." };
  if (tsResult.value.status === "APPROVED") return { error: "Cannot delete an approved timesheet." };

  const result = await safeDb(prisma.timesheet.delete({ where: { id: timesheetId } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/timesheets");
  if (tsResult.value.projectId) revalidatePath(`/dashboard/projects/${tsResult.value.projectId}`);
  return { success: true };
}

// ─── Crew Expenses ────────────────────────────────────────────────────────────

export async function createCrewExpense(data: unknown) {
  const parsed = crewExpenseSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const result = await safeDb(
    prisma.crewExpense.create({
      data: {
        crewMemberId: d.crewMemberId,
        projectId: d.projectId || null,
        description: d.description,
        amount: d.amount,
        currency: d.currency,
        date: new Date(d.date),
        status: "PENDING",
        notes: d.notes,
      },
    })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/timesheets");
  revalidatePath(`/dashboard/crew/${d.crewMemberId}`);
  return { success: true };
}

export async function updateCrewExpenseStatus(
  expenseId: string,
  status: "PENDING" | "APPROVED" | "REIMBURSED" | "REJECTED"
) {
  const result = await safeDb(
    prisma.crewExpense.update({ where: { id: expenseId }, data: { status } })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/timesheets");
  return { success: true };
}
