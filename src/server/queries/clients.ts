import { prisma } from "@/lib/prisma";

export interface GetClientsParams {
  search?: string;
  isActive?: boolean;
}

export async function getClients(params: GetClientsParams = {}) {
  const { search, isActive = true } = params;
  return prisma.client.findMany({
    where: {
      isActive,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { contactName: { contains: search, mode: "insensitive" } },
              { refCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { projects: true, invoices: true } },
    },
    orderBy: { name: "asc" },
  });
}

export type ClientListEntry = Awaited<ReturnType<typeof getClients>>[number];

export async function getClientById(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { startAt: "desc" },
        select: {
          id: true,
          refCode: true,
          name: true,
          type: true,
          status: true,
          startAt: true,
          endAt: true,
          currencyCode: true,
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          refCode: true,
          status: true,
          type: true,
          totalAmount: true,
          currencyCode: true,
          dueDate: true,
        },
      },
    },
  });
}

export type ClientDetail = Awaited<ReturnType<typeof getClientById>>;

// Lightweight list for select dropdowns
export async function getClientsForSelect() {
  return prisma.client.findMany({
    where: { isActive: true },
    select: { id: true, name: true, refCode: true },
    orderBy: { name: "asc" },
  });
}
