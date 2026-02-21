import { prisma } from "@/lib/prisma";

export interface GetProjectsParams {
  search?: string;
  status?: string;
  clientId?: string;
}

export async function getProjects(params: GetProjectsParams = {}) {
  const { search, status, clientId } = params;

  const validStatuses = [
    "INQUIRY", "QUOTED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED",
  ];

  return prisma.project.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      ...(status && validStatuses.includes(status)
        ? { status: status as never }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { refCode: { contains: search, mode: "insensitive" } },
              { venue: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
      _count: {
        select: { equipmentItems: true, crewAssignments: true, invoices: true },
      },
    },
    orderBy: [{ startAt: "desc" }],
  });
}

export type ProjectListEntry = Awaited<ReturnType<typeof getProjects>>[number];

export async function getProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, refCode: true } },
      createdBy: { select: { id: true, name: true } },
      equipmentItems: {
        include: {
          inventoryItem: {
            include: { category: true },
          },
          allocations: {
            include: { serializedUnit: { select: { id: true, serialNumber: true } } },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      subRentals: {
        include: { items: true },
        orderBy: { createdAt: "asc" },
      },
      expenses: { orderBy: { date: "desc" } },
      timesheets: {
        where: { status: "APPROVED" },
        select: { totalAmount: true, currency: true },
      },
      invoices: {
        select: {
          id: true,
          refCode: true,
          status: true,
          type: true,
          totalAmount: true,
          paidAmount: true,
          currencyCode: true,
        },
      },
    },
  });
}

export type ProjectDetail = Awaited<ReturnType<typeof getProjectById>>;

// ─── P&L calculation ─────────────────────────────────────────────────────────

export function computeProjectPnL(project: NonNullable<ProjectDetail>) {
  // Equipment revenue: unitRateAmount * rateDays * quantityNeeded
  const equipmentRevenue = project.equipmentItems.reduce((sum, item) => {
    const rate = item.unitRateAmount ?? 0;
    const days = item.rateDays;
    const qty = item.quantityNeeded;
    return sum + rate * days * qty;
  }, 0);

  // Sub-rental costs
  const subRentalCosts = project.subRentals
    .flatMap((sr) => sr.items)
    .reduce((sum, item) => {
      return sum + item.unitRateAmount * item.rateDays * item.quantity;
    }, 0);

  // Project expenses
  const expenseTotal = project.expenses.reduce((sum, e) => sum + e.amount, 0);

  // Labor costs (approved timesheets only)
  const laborCosts = project.timesheets.reduce(
    (sum, ts) => sum + (ts.totalAmount ?? 0),
    0
  );

  const grossRevenue = equipmentRevenue;
  const totalCosts = subRentalCosts + expenseTotal + laborCosts;
  const grossMargin = grossRevenue - totalCosts;
  const marginPct = grossRevenue > 0 ? (grossMargin / grossRevenue) * 100 : 0;

  return {
    equipmentRevenue,
    subRentalCosts,
    expenseTotal,
    laborCosts,
    totalCosts,
    grossMargin,
    marginPct,
  };
}

export type ProjectPnL = ReturnType<typeof computeProjectPnL>;
