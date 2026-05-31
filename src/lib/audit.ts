/**
 * Audit logging utility.
 *
 * logAudit() is fire-and-forget — a failed audit write must never roll back
 * the main business operation. Errors are swallowed (console only).
 *
 * diffObjects() computes before/after changes for a subset of fields.
 */

import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@prisma/client";

export type { AuditAction };

export interface AuditParams {
  entityType: string;
  entityId: string;
  entityLabel?: string;
  action: AuditAction;
  userId?: string | null;
  changes?: Record<string, { from: unknown; to: unknown }>;
  meta?: Record<string, unknown>;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entityType:  params.entityType,
        entityId:    params.entityId,
        entityLabel: params.entityLabel ?? null,
        action:      params.action,
        userId:      params.userId ?? null,
        // Prisma Json fields require explicit cast
        changes:     params.changes ? (params.changes as object) : undefined,
        meta:        params.meta ? (params.meta as object) : undefined,
      },
    });
  } catch (e) {
    console.error("[audit] Failed to write audit log:", e);
  }
}

/**
 * Compare a subset of fields between a before-snapshot and the update payload.
 * Returns only fields that actually changed.
 *
 * Values are serialised to strings for storage (handles Decimal, Date, null).
 */
export function diffObjects<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  watchFields: (keyof T)[]
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const field of watchFields) {
    const fromRaw = before[field];
    const toRaw   = after[field];

    // Skip fields not present in the update payload
    if (!(field as string in after)) continue;

    const from = serialise(fromRaw);
    const to   = serialise(toRaw);

    if (from !== to) {
      changes[field as string] = { from: fromRaw, to: toRaw };
    }
  }

  return changes;
}

function serialise(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
