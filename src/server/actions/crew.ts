"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateShortCode } from "@/lib/utils";
import { auth } from "@/lib/auth";
import {
  crewMemberSchema,
  crewRateSchema,
  crewAssignmentSchema,
  timesheetSchema,
  crewExpenseSchema,
} from "@/schemas/crew";
import {
  calculateShiftOT,
  calculateShiftTotal,
  DEFAULT_OT_POLICY,
} from "@/lib/payroll";
import { getActiveCrewRates } from "@/server/queries/crew";

// ─── Crew Members ─────────────────────────────────────────────────────────────

export async function createCrewMember(data: unknown) {
  const parsed = crewMemberSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const refCode = generateShortCode("CRW");

  const member = await prisma.crewMember.create({
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
  });

  revalidatePath("/dashboard/crew");
  return { success: true, id: member.id };
}

export async function updateCrewMember(id: string, data: unknown) {
  const parsed = crewMemberSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  await prisma.crewMember.update({
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
  });

  revalidatePath("/dashboard/crew");
  revalidatePath(`/dashboard/crew/${id}`);
  return { success: true };
}

// ─── Crew Rates ───────────────────────────────────────────────────────────────

export async function addCrewRate(crewMemberId: string, data: unknown) {
  const parsed = crewRateSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  await prisma.crewRate.create({
    data: {
      crewMemberId,
      rateType: d.rateType,
      amount: d.amount,
      currency: d.currency,
      effectiveFrom: new Date(d.effectiveFrom),
      effectiveTo: d.effectiveTo ? new Date(d.effectiveTo) : null,
    },
  });

  revalidatePath(`/dashboard/crew/${crewMemberId}`);
  return { success: true };
}

export async function deleteCrewRate(rateId: string, crewMemberId: string) {
  await prisma.crewRate.delete({ where: { id: rateId } });
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

  // Availability conflict check
  const conflict = await prisma.crewAssignment.findFirst({
    where: {
      crewMemberId: d.crewMemberId,
      projectId: { not: projectId },
      startAt: { lte: endAt },
      endAt: { gte: startAt },
    },
    include: { project: { select: { name: true } } },
  });

  if (conflict) {
    return {
      error: `Crew member is already assigned to "${conflict.project.name}" during this period.`,
    };
  }

  await prisma.crewAssignment.create({
    data: {
      projectId,
      crewMemberId: d.crewMemberId,
      role: d.role,
      startAt,
      endAt,
      notes: d.notes,
    },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/crew");
  return { success: true };
}

export async function deleteCrewAssignment(assignmentId: string, projectId: string) {
  await prisma.crewAssignment.delete({ where: { id: assignmentId } });
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

// ─── Timesheets ───────────────────────────────────────────────────────────────

export async function createTimesheet(projectId: string, data: unknown) {
  const parsed = timesheetSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  await prisma.timesheet.create({
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
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/timesheets");
  return { success: true };
}

export async function submitTimesheet(timesheetId: string) {
  await prisma.timesheet.update({
    where: { id: timesheetId },
    data: { status: "SUBMITTED" },
  });
  revalidatePath("/dashboard/timesheets");
  return { success: true };
}

export async function approveTimesheet(timesheetId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated." };

  const ts = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    include: { crewMember: { include: { rates: true } } },
  });
  if (!ts) return { error: "Timesheet not found." };
  if (!ts.clockOut) return { error: "Timesheet has no clock-out time." };

  // Get OT policy from system settings
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "singleton" },
    select: { otDailyThreshold: true, otWeeklyThreshold: true },
  });

  const policy = {
    dailyOTThreshold: settings?.otDailyThreshold ?? 8,
    dailyDTThreshold: (settings?.otDailyThreshold ?? 8) * 1.5,
    weeklyOTThreshold: settings?.otWeeklyThreshold ?? 40,
  };

  const otResult = calculateShiftOT(
    {
      id: ts.id,
      clockIn: ts.clockIn,
      clockOut: ts.clockOut,
      breakMinutes: ts.breakMinutes,
    },
    policy
  );

  // Snapshot current rates
  const rates = await getActiveCrewRates(ts.crewMemberId);
  const find = (type: string) =>
    rates.find((r) => r.rateType === type)?.amount ?? 0;

  const regularRate = find("REGULAR");
  const overtimeRate = find("OVERTIME") || regularRate * 1.5;
  const doubleTimeRate = find("DOUBLE_TIME") || regularRate * 2;

  const totalAmount =
    ts.timeType === "WORK"
      ? calculateShiftTotal(otResult, regularRate, overtimeRate, doubleTimeRate)
      : ts.timeType === "PER_DIEM"
      ? find("PER_DIEM")
      : find("TRAVEL_DAY");

  await prisma.timesheet.update({
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
  });

  revalidatePath("/dashboard/timesheets");
  revalidatePath(`/dashboard/projects/${ts.projectId}`);
  return { success: true };
}

export async function rejectTimesheet(timesheetId: string) {
  await prisma.timesheet.update({
    where: { id: timesheetId },
    data: { status: "REJECTED" },
  });
  revalidatePath("/dashboard/timesheets");
  return { success: true };
}

export async function deleteTimesheet(timesheetId: string) {
  const ts = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    select: { projectId: true, status: true },
  });
  if (!ts) return { error: "Not found." };
  if (ts.status === "APPROVED") return { error: "Cannot delete an approved timesheet." };

  await prisma.timesheet.delete({ where: { id: timesheetId } });
  revalidatePath("/dashboard/timesheets");
  if (ts.projectId) revalidatePath(`/dashboard/projects/${ts.projectId}`);
  return { success: true };
}

// ─── Crew Expenses ────────────────────────────────────────────────────────────

export async function createCrewExpense(data: unknown) {
  const parsed = crewExpenseSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  await prisma.crewExpense.create({
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
  });

  revalidatePath("/dashboard/timesheets");
  revalidatePath(`/dashboard/crew/${d.crewMemberId}`);
  return { success: true };
}

export async function updateCrewExpenseStatus(
  expenseId: string,
  status: "PENDING" | "APPROVED" | "REIMBURSED" | "REJECTED"
) {
  await prisma.crewExpense.update({ where: { id: expenseId }, data: { status } });
  revalidatePath("/dashboard/timesheets");
  return { success: true };
}
