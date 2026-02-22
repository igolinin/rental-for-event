import { prisma } from "@/lib/prisma";

// ─── Dashboard KPIs ───────────────────────────────────────────────────────────

export async function getDashboardKpis() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const [
    activeProjectsCount,
    openInvoicesCount,
    openInvoicesBalance,
    maintenanceAlertsCount,
    crewBookedTodayCount,
    draftTimesheetsCount,
    submittedTimesheetsCount,
    monthlyRevenueResult,
  ] = await Promise.all([
    prisma.project.count({
      where: { status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
    }),
    prisma.invoice.count({
      where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.maintenanceLog.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    prisma.crewAssignment.count({
      where: {
        startAt: { lte: todayEnd },
        endAt: { gte: todayStart },
      },
    }),
    prisma.timesheet.count({ where: { status: "DRAFT" } }),
    prisma.timesheet.count({ where: { status: "SUBMITTED" } }),
    prisma.invoice.aggregate({
      where: {
        status: { not: "VOID" },
        issueDate: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { totalAmount: true },
    }),
  ]);

  const openBalance =
    (openInvoicesBalance._sum.totalAmount ?? 0) -
    (openInvoicesBalance._sum.paidAmount ?? 0);

  return {
    activeProjectsCount,
    openInvoicesCount,
    openBalance,
    maintenanceAlertsCount,
    crewBookedTodayCount,
    draftTimesheetsCount,
    submittedTimesheetsCount,
    monthlyRevenue: monthlyRevenueResult._sum.totalAmount ?? 0,
  };
}

// ─── Revenue report ───────────────────────────────────────────────────────────

export interface RevenueReportParams {
  fromDate: string;
  toDate: string;
}

export async function getRevenueReport({ fromDate, toDate }: RevenueReportParams) {
  const from = new Date(fromDate);
  const to = new Date(toDate + "T23:59:59");

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { not: "VOID" },
      issueDate: { gte: from, lte: to },
    },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, refCode: true } },
    },
    orderBy: { issueDate: "desc" },
  });

  const totalRevenue = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const totalBalance = totalRevenue - totalPaid;

  const byClient = Object.values(
    invoices.reduce<Record<string, { clientName: string; total: number; paid: number }>>(
      (acc, inv) => {
        const key = inv.client.id;
        if (!acc[key]) acc[key] = { clientName: inv.client.name, total: 0, paid: 0 };
        acc[key].total += inv.totalAmount;
        acc[key].paid += inv.paidAmount;
        return acc;
      },
      {}
    )
  ).sort((a, b) => b.total - a.total);

  return { invoices, totalRevenue, totalPaid, totalBalance, byClient };
}

// ─── Inventory utilization ────────────────────────────────────────────────────

export interface UtilizationReportParams {
  fromDate: string;
  toDate: string;
}

export async function getInventoryUtilizationReport({
  fromDate,
  toDate,
}: UtilizationReportParams) {
  const from = new Date(fromDate);
  const to = new Date(toDate + "T23:59:59");
  const totalDays = Math.max(
    1,
    Math.ceil((to.getTime() - from.getTime()) / 86400000)
  );

  // Query ProjectEquipmentItem joined with project and inventoryItem
  const lineItems = await prisma.projectEquipmentItem.findMany({
    where: {
      project: {
        startAt: { lte: to },
        endAt: { gte: from },
        status: { not: "CANCELLED" },
      },
    },
    include: {
      project: { select: { startAt: true, endAt: true } },
      inventoryItem: {
        select: {
          id: true,
          name: true,
          totalQuantity: true,
          category: { select: { name: true } },
        },
      },
    },
  });

  // Group by inventory item
  const byItem = new Map<
    string,
    {
      id: string;
      name: string;
      categoryName: string;
      totalQuantity: number;
      bookedDays: number;
    }
  >();

  for (const li of lineItems) {
    const item = li.inventoryItem;
    if (!byItem.has(item.id)) {
      byItem.set(item.id, {
        id: item.id,
        name: item.name,
        categoryName: item.category.name,
        totalQuantity: item.totalQuantity,
        bookedDays: 0,
      });
    }
    // Days within the report range
    const start = li.project.startAt > from ? li.project.startAt : from;
    const end = li.project.endAt < to ? li.project.endAt : to;
    const days = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    byItem.get(item.id)!.bookedDays += days * li.quantityNeeded;
  }

  // Add items that had no bookings (from all active inventory items)
  const allItems = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      totalQuantity: true,
      category: { select: { name: true } },
    },
  });

  for (const item of allItems) {
    if (!byItem.has(item.id)) {
      byItem.set(item.id, {
        id: item.id,
        name: item.name,
        categoryName: item.category.name,
        totalQuantity: item.totalQuantity,
        bookedDays: 0,
      });
    }
  }

  const rows = Array.from(byItem.values()).map((row) => {
    const totalUnitDays = row.totalQuantity * totalDays;
    const utilizationPct =
      totalUnitDays > 0
        ? Math.min(100, Math.round((row.bookedDays / totalUnitDays) * 100))
        : 0;
    return { ...row, utilizationPct };
  });

  return rows.sort((a, b) => b.utilizationPct - a.utilizationPct);
}

// ─── Labor report ─────────────────────────────────────────────────────────────

export interface LaborReportParams {
  fromDate: string;
  toDate: string;
}

export async function getLaborReport({ fromDate, toDate }: LaborReportParams) {
  const from = new Date(fromDate);
  const to = new Date(toDate + "T23:59:59");

  const timesheets = await prisma.timesheet.findMany({
    where: {
      status: "APPROVED",
      clockIn: { gte: from, lte: to },
    },
    include: {
      crewMember: { select: { id: true, firstName: true, lastName: true, type: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { clockIn: "desc" },
  });

  const totalLabor = timesheets.reduce((s, t) => s + (t.totalAmount ?? 0), 0);
  const totalRegularHours = timesheets.reduce(
    (s, t) => s + Number(t.regularHours ?? 0),
    0
  );
  const totalOvertimeHours = timesheets.reduce(
    (s, t) => s + Number(t.overtimeHours ?? 0) + Number(t.doubleTimeHours ?? 0),
    0
  );

  const byCrew = Object.values(
    timesheets.reduce<
      Record<
        string,
        {
          crewMemberId: string;
          name: string;
          type: string;
          totalAmount: number;
          regularHours: number;
          overtimeHours: number;
          entries: number;
        }
      >
    >((acc, ts) => {
      const key = ts.crewMember.id;
      if (!acc[key])
        acc[key] = {
          crewMemberId: key,
          name: `${ts.crewMember.firstName} ${ts.crewMember.lastName}`,
          type: ts.crewMember.type,
          totalAmount: 0,
          regularHours: 0,
          overtimeHours: 0,
          entries: 0,
        };
      acc[key].totalAmount += ts.totalAmount ?? 0;
      acc[key].regularHours += Number(ts.regularHours ?? 0);
      acc[key].overtimeHours +=
        Number(ts.overtimeHours ?? 0) + Number(ts.doubleTimeHours ?? 0);
      acc[key].entries += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.totalAmount - a.totalAmount);

  return {
    timesheets,
    totalLabor,
    totalRegularHours,
    totalOvertimeHours,
    byCrew,
  };
}
