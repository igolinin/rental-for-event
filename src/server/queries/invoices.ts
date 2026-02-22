import { prisma } from "@/lib/prisma";

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
