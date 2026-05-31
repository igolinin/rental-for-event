import { prisma } from "@/lib/prisma";

export interface GetAuditLogsParams {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  fromDate?: string;
  toDate?: string;
  cursor?: string;
  take?: number;
}

export async function getAuditLogs(params: GetAuditLogsParams = {}) {
  const { entityType, entityId, userId, action, fromDate, toDate, cursor, take = 50 } = params;

  return prisma.auditLog.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(userId ? { userId } : {}),
      ...(action ? { action: action as never } : {}),
      ...(fromDate ? { createdAt: { gte: new Date(fromDate) } } : {}),
      ...(toDate ? { createdAt: { lte: new Date(toDate + "T23:59:59") } } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

export type AuditLogEntry = Awaited<ReturnType<typeof getAuditLogs>>[number];

export async function getEntityHistory(entityType: string, entityId: string, take = 50) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export type EntityHistoryEntry = Awaited<ReturnType<typeof getEntityHistory>>[number];

export async function getAuditLogEntityTypes() {
  const types = await prisma.auditLog.findMany({
    distinct: ["entityType"],
    select: { entityType: true },
    orderBy: { entityType: "asc" },
  });
  return types.map((t) => t.entityType);
}
