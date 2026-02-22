import { prisma } from "@/lib/prisma";

export interface GetCrewParams {
  search?: string;
  type?: "EMPLOYEE" | "FREELANCER";
  isActive?: boolean;
}

export async function getCrewMembers(params: GetCrewParams = {}) {
  const { search, type, isActive = true } = params;
  return prisma.crewMember.findMany({
    where: {
      isActive,
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { role: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      rates: { orderBy: { effectiveFrom: "desc" }, take: 5 },
      _count: { select: { assignments: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export type CrewListEntry = Awaited<ReturnType<typeof getCrewMembers>>[number];

export async function getCrewMemberById(id: string) {
  return prisma.crewMember.findUnique({
    where: { id },
    include: {
      rates: { orderBy: [{ rateType: "asc" }, { effectiveFrom: "desc" }] },
      assignments: {
        include: {
          project: { select: { id: true, name: true, refCode: true, startAt: true, endAt: true } },
        },
        orderBy: { startAt: "desc" },
        take: 20,
      },
      timesheets: {
        orderBy: { clockIn: "desc" },
        take: 30,
        include: {
          project: { select: { id: true, name: true } },
        },
      },
      expenses: {
        orderBy: { date: "desc" },
        take: 20,
      },
    },
  });
}

export type CrewMemberDetail = Awaited<ReturnType<typeof getCrewMemberById>>;

// Lightweight for selects
export async function getCrewForSelect() {
  return prisma.crewMember.findMany({
    where: { isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      type: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

// ─── Timesheets ──────────────────────────────────────────────────────────────

export interface GetTimesheetsParams {
  projectId?: string;
  crewMemberId?: string;
  status?: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
}

export async function getTimesheets(params: GetTimesheetsParams = {}) {
  const { projectId, crewMemberId, status } = params;
  return prisma.timesheet.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(crewMemberId ? { crewMemberId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      crewMember: { select: { id: true, firstName: true, lastName: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { clockIn: "desc" },
  });
}

export type TimesheetEntry = Awaited<ReturnType<typeof getTimesheets>>[number];

// ─── Active crew rates (for snapshot on approval) ────────────────────────────

export async function getActiveCrewRates(crewMemberId: string) {
  const now = new Date();
  return prisma.crewRate.findMany({
    where: {
      crewMemberId,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
}
