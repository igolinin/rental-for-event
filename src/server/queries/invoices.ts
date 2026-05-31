import { prisma } from "@/lib/prisma";
import { computeLineTotal, resolveTiers } from "@/lib/pricing";
import { toTiersLite, getDefaultProfile } from "@/server/queries/pricing";

export interface GetInvoicesParams {
  projectId?: string;
  clientId?: string;
  status?: string;
}

export async function getInvoices(params: GetInvoicesParams = {}) {
  const { projectId, clientId, status } = params;
  return prisma.invoice.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, refCode: true } },
      _count: { select: { payments: true } },
    },
    orderBy: { issueDate: "desc" },
  });
}

export type InvoiceListEntry = Awaited<ReturnType<typeof getInvoices>>[number];

export async function getInvoiceById(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      project: { select: { id: true, name: true, refCode: true, startAt: true, endAt: true } },
      createdBy: { select: { id: true, name: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { receivedAt: "desc" } },
    },
  });
}

export type InvoiceDetail = Awaited<ReturnType<typeof getInvoiceById>>;

/**
 * Build proposed invoice line items from a project's kit list, using the
 * curve-resolved total for each piece of equipment. Used to pre-fill the
 * invoice form when generating an invoice from a project.
 */
export async function buildInvoiceLinesFromProject(projectId: string) {
  const [project, defaultProfile] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: { select: { id: true } },
        equipmentItems: {
          include: {
            inventoryItem: {
              include: { pricingProfile: { include: { tiers: { orderBy: { minDays: "asc" } } } } },
            },
            pricingProfile: { include: { tiers: { orderBy: { minDays: "asc" } } } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    getDefaultProfile(),
  ]);

  if (!project) return null;
  const defaultTiers = toTiersLite(defaultProfile?.tiers);

  const lineItems = project.equipmentItems.map((item, idx) => {
    const tiers = resolveTiers(
      toTiersLite(item.pricingProfile?.tiers),
      toTiersLite(item.inventoryItem.pricingProfile?.tiers),
      defaultTiers
    );
    const total = computeLineTotal(
      item.unitRateAmount ?? 0,
      item.rateDays,
      item.quantityNeeded,
      tiers,
      item.rateType
    );
    return {
      description:
        item.description ||
        `${item.inventoryItem.name} — ${item.rateDays} day(s)`,
      quantity: item.quantityNeeded,
      // unitAmount is per-unit so the form's quantity × unitAmount reproduces the total
      unitAmount: item.quantityNeeded > 0 ? Math.round(total / item.quantityNeeded) : total,
      sortOrder: idx,
    };
  });

  return {
    projectId: project.id,
    clientId: project.clientId,
    currencyCode: project.currencyCode,
    lineItems,
  };
}
