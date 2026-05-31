import { prisma } from "@/lib/prisma";
import { computeLineTotal, resolveTiers, type PricingTierLite } from "@/lib/pricing";
import { toTiersLite } from "@/server/queries/pricing";

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
            include: {
              category: true,
              pricingProfile: { include: { tiers: { orderBy: { minDays: "asc" } } } },
            },
          },
          pricingProfile: { include: { tiers: { orderBy: { minDays: "asc" } } } },
          allocations: {
            include: { serializedUnit: { select: { id: true, serialNumber: true } } },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      phases: {
        include: {
          crewAssignments: {
            include: {
              crewMember: { select: { id: true, firstName: true, lastName: true, role: true, type: true } },
            },
            orderBy: { startAt: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      crewAssignments: {
        include: {
          crewMember: { select: { id: true, firstName: true, lastName: true, role: true, type: true } },
          phase: { select: { id: true, name: true, customLabel: true } },
        },
        orderBy: { startAt: "asc" },
      },
      laborSubcontracts: {
        include: {
          phase: { select: { id: true, name: true, customLabel: true } },
        },
        orderBy: { createdAt: "asc" },
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

export function computeProjectPnL(
  project: NonNullable<ProjectDetail>,
  defaultTiers: PricingTierLite[] | null = null
) {
  // Equipment revenue: dailyRate × curveMultiplier(duration) × quantity,
  // resolving the curve line → item → default. No profile → linear (legacy) math.
  const equipmentRevenue = project.equipmentItems.reduce((sum, item) => {
    const tiers = resolveTiers(
      toTiersLite(item.pricingProfile?.tiers),
      toTiersLite(item.inventoryItem.pricingProfile?.tiers),
      defaultTiers
    );
    return sum + computeLineTotal(
      item.unitRateAmount ?? 0,
      item.rateDays,
      item.quantityNeeded,
      tiers,
      item.rateType
    );
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

  // Labor subcontract costs (non-cancelled)
  const laborSubcontractCosts = project.laborSubcontracts
    .filter((lsc) => lsc.status !== "CANCELLED")
    .reduce((sum, lsc) => {
      if (!lsc.dailyRateAmount) return sum;
      const days = Math.max(
        1,
        Math.ceil((lsc.endAt.getTime() - lsc.startAt.getTime()) / 86400000) + 1
      );
      return sum + lsc.dailyRateAmount * lsc.quantity * days;
    }, 0);

  const grossRevenue = equipmentRevenue;
  const totalCosts = subRentalCosts + expenseTotal + laborCosts + laborSubcontractCosts;
  const grossMargin = grossRevenue - totalCosts;
  const marginPct = grossRevenue > 0 ? (grossMargin / grossRevenue) * 100 : 0;

  return {
    equipmentRevenue,
    subRentalCosts,
    expenseTotal,
    laborCosts,
    laborSubcontractCosts,
    totalCosts,
    grossMargin,
    marginPct,
  };
}

export type ProjectPnL = ReturnType<typeof computeProjectPnL>;
