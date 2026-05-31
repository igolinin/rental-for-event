import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { canDo, canDoSync } from "@/lib/permissions";
import type { Session } from "next-auth";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userPermission: { findMany: vi.fn() },
  },
}));

function makeSession(role: string, id = "user-1"): Session {
  return {
    user: { id, name: "Test", email: "test@test.com", role: role as never },
    expires: "2099-01-01",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.userPermission.findMany).mockResolvedValue([]);
});

describe("canDo — role defaults (no DB overrides)", () => {
  it("ADMIN can do anything", async () => {
    expect(await canDo(makeSession("ADMIN"), "INVENTORY", "DELETE")).toBe(true);
    expect(await canDo(makeSession("ADMIN"), "SETTINGS", "MANAGE")).toBe(true);
    expect(await canDo(makeSession("ADMIN"), "AUDIT", "DELETE")).toBe(true);
  });

  it("MANAGER can CREATE inventory", async () => {
    expect(await canDo(makeSession("MANAGER"), "INVENTORY", "CREATE")).toBe(true);
  });

  it("MANAGER can MANAGE inventory pricing", async () => {
    expect(await canDo(makeSession("MANAGER"), "INVENTORY_PRICING", "MANAGE")).toBe(true);
  });

  it("MANAGER cannot DELETE inventory", async () => {
    expect(await canDo(makeSession("MANAGER"), "INVENTORY", "DELETE")).toBe(false);
  });

  it("STAFF can only READ inventory", async () => {
    expect(await canDo(makeSession("STAFF"), "INVENTORY", "READ")).toBe(true);
    expect(await canDo(makeSession("STAFF"), "INVENTORY", "CREATE")).toBe(false);
    expect(await canDo(makeSession("STAFF"), "INVENTORY", "UPDATE")).toBe(false);
  });

  it("STAFF cannot MANAGE inventory pricing", async () => {
    expect(await canDo(makeSession("STAFF"), "INVENTORY_PRICING", "MANAGE")).toBe(false);
  });

  it("STAFF can CREATE timesheets", async () => {
    expect(await canDo(makeSession("STAFF"), "TIMESHEETS", "CREATE")).toBe(true);
  });

  it("STAFF cannot APPROVE timesheets", async () => {
    expect(await canDo(makeSession("STAFF"), "TIMESHEETS", "APPROVE")).toBe(false);
  });

  it("STAFF cannot access SETTINGS", async () => {
    expect(await canDo(makeSession("STAFF"), "SETTINGS", "READ")).toBe(false);
  });

  it("VIEWER gets READ on inventory", async () => {
    expect(await canDo(makeSession("VIEWER"), "INVENTORY", "READ")).toBe(true);
    expect(await canDo(makeSession("VIEWER"), "INVENTORY", "CREATE")).toBe(false);
  });

  it("null session returns false", async () => {
    expect(await canDo(null, "INVENTORY", "READ")).toBe(false);
  });
});

describe("canDo — explicit UserPermission overrides", () => {
  it("explicit GRANT overrides role default deny", async () => {
    // STAFF cannot delete inventory by default
    vi.mocked(prisma.userPermission.findMany).mockResolvedValue([
      { id: "p1", userId: "user-1", resource: "INVENTORY", action: "DELETE", resourceId: null, granted: true, grantedById: null, createdAt: new Date() },
    ] as never);
    expect(await canDo(makeSession("STAFF"), "INVENTORY", "DELETE")).toBe(true);
  });

  it("explicit DENY overrides role default grant", async () => {
    // MANAGER can manage pricing by default, but explicit deny overrides
    vi.mocked(prisma.userPermission.findMany).mockResolvedValue([
      { id: "p2", userId: "user-1", resource: "INVENTORY_PRICING", action: "MANAGE", resourceId: null, granted: false, grantedById: null, createdAt: new Date() },
    ] as never);
    expect(await canDo(makeSession("MANAGER"), "INVENTORY_PRICING", "MANAGE")).toBe(false);
  });

  it("resource-scoped DENY blocks specific warehouse but not others", async () => {
    // MANAGER has a deny for warehouse "wh-secret"
    vi.mocked(prisma.userPermission.findMany).mockResolvedValue([
      { id: "p3", userId: "user-1", resource: "WAREHOUSES", action: "READ", resourceId: "wh-secret", granted: false, grantedById: null, createdAt: new Date() },
    ] as never);
    // For "wh-secret", specific deny wins
    expect(await canDo(makeSession("MANAGER"), "WAREHOUSES", "READ", "wh-secret")).toBe(false);
  });

  it("ADMIN bypasses DB checks entirely", async () => {
    // DB is never queried for ADMIN
    expect(await canDo(makeSession("ADMIN"), "SETTINGS", "DELETE")).toBe(true);
    expect(vi.mocked(prisma.userPermission.findMany)).not.toHaveBeenCalled();
  });
});

describe("canDoSync — synchronous role-only check", () => {
  it("ADMIN returns true for any resource", () => {
    expect(canDoSync("ADMIN", "AUDIT", "DELETE")).toBe(true);
  });

  it("MANAGER returns true for INVENTORY CREATE", () => {
    expect(canDoSync("MANAGER", "INVENTORY", "CREATE")).toBe(true);
  });

  it("STAFF returns false for INVENTORY CREATE", () => {
    expect(canDoSync("STAFF", "INVENTORY", "CREATE")).toBe(false);
  });

  it("undefined role returns false", () => {
    expect(canDoSync(undefined, "INVENTORY", "READ")).toBe(false);
  });
});
