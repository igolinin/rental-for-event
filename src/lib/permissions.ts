/**
 * Permission system.
 *
 * Two-layer model:
 *   1. Role defaults — what each UserRole can do by default.
 *   2. UserPermission overrides — explicit per-user grants/denies stored in DB.
 *      An explicit deny always wins over a role default.
 *      An explicit grant wins over a role default deny.
 *
 * ADMIN bypasses all checks and can always do everything.
 */

import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

export type { PermissionResource, PermissionAction } from "@prisma/client";
import type { PermissionResource, PermissionAction } from "@prisma/client";

// ─── Role default matrix ──────────────────────────────────────────────────────

type ResourceMap = Partial<Record<PermissionResource, PermissionAction[]>>;

const ALL_ACTIONS: PermissionAction[] = ["READ", "CREATE", "UPDATE", "DELETE", "APPROVE", "MANAGE"];
const ALL_RESOURCES: PermissionResource[] = [
  "INVENTORY", "INVENTORY_PRICING", "WAREHOUSES", "PROJECTS",
  "CREW", "TIMESHEETS", "INVOICES", "CLIENTS", "REPORTS", "SETTINGS", "AUDIT",
];

function allOf(): ResourceMap {
  return Object.fromEntries(ALL_RESOURCES.map((r) => [r, ALL_ACTIONS])) as ResourceMap;
}

const ROLE_DEFAULTS: Record<string, ResourceMap> = {
  ADMIN: allOf(),

  MANAGER: {
    INVENTORY:         ["READ", "CREATE", "UPDATE"],
    INVENTORY_PRICING: ["READ", "MANAGE"],
    WAREHOUSES:        ["READ", "CREATE", "UPDATE"],
    PROJECTS:          ["READ", "CREATE", "UPDATE"],
    CREW:              ["READ", "CREATE", "UPDATE"],
    TIMESHEETS:        ["READ", "CREATE", "APPROVE"],
    INVOICES:          ["READ", "CREATE", "UPDATE"],
    CLIENTS:           ["READ", "CREATE", "UPDATE"],
    REPORTS:           ["READ"],
    SETTINGS:          ["READ"],
    AUDIT:             ["READ"],
  },

  STAFF: {
    INVENTORY:         ["READ"],
    WAREHOUSES:        ["READ"],
    PROJECTS:          ["READ"],
    CREW:              ["READ"],
    TIMESHEETS:        ["READ", "CREATE"],
    INVOICES:          ["READ"],
    CLIENTS:           ["READ"],
    REPORTS:           ["READ"],
    SETTINGS:          [],
    AUDIT:             [],
  },

  VIEWER: {
    INVENTORY:         ["READ"],
    WAREHOUSES:        ["READ"],
    PROJECTS:          ["READ"],
    CREW:              ["READ"],
    TIMESHEETS:        ["READ"],
    INVOICES:          ["READ"],
    CLIENTS:           ["READ"],
    REPORTS:           ["READ"],
    SETTINGS:          [],
    AUDIT:             [],
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether the current session user may perform `action` on `resource`.
 * Optionally scope to a specific resource instance (e.g. a warehouseId).
 *
 * ADMIN always returns true.
 * Explicit DB overrides (grant/deny) take precedence over role defaults.
 */
export async function canDo(
  session: Session | null,
  resource: PermissionResource,
  action: PermissionAction,
  resourceId?: string
): Promise<boolean> {
  if (!session?.user?.id) return false;
  const role = session.user.role as string;
  if (role === "ADMIN") return true;

  const userId = session.user.id;

  // Check explicit overrides — most specific (with resourceId) wins over general (null resourceId)
  const overrides = await prisma.userPermission.findMany({
    where: {
      userId,
      resource,
      action,
      resourceId: resourceId ? { in: [resourceId, null as unknown as string] } : null,
    },
  });

  // Specific resourceId override takes priority
  if (resourceId) {
    const specific = overrides.find((o) => o.resourceId === resourceId);
    if (specific) return specific.granted;
  }
  const general = overrides.find((o) => o.resourceId === null);
  if (general) return general.granted;

  // Fall back to role default
  const defaults = ROLE_DEFAULTS[role]?.[resource] ?? [];
  return (defaults as string[]).includes(action);
}

/**
 * Assert permission — returns `{ error }` if not allowed, null if allowed.
 * Drop-in for server action guards.
 */
export async function requirePermission(
  session: Session | null,
  resource: PermissionResource,
  action: PermissionAction,
  resourceId?: string
): Promise<{ error: string } | null> {
  if (!session?.user) return { error: "Not authenticated." };
  const allowed = await canDo(session, resource, action, resourceId);
  if (!allowed) return { error: "You don't have permission to perform this action." };
  return null;
}

/**
 * Synchronous check for UI rendering — uses role defaults only (no DB query).
 * Use for hiding/showing buttons. Server actions always do the full async check.
 */
export function canDoSync(
  role: string | undefined,
  resource: PermissionResource,
  action: PermissionAction
): boolean {
  if (!role) return false;
  if (role === "ADMIN") return true;
  const defaults = ROLE_DEFAULTS[role]?.[resource] ?? [];
  return (defaults as string[]).includes(action);
}

export { ALL_RESOURCES, ALL_ACTIONS };
