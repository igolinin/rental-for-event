import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { logAudit, diffObjects } from "@/lib/audit";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── diffObjects ──────────────────────────────────────────────────────────────

describe("diffObjects", () => {
  it("detects changed fields", () => {
    const before = { name: "Old Name", price: 100, notes: "same" };
    const after  = { name: "New Name", price: 150, notes: "same" };
    const diff = diffObjects(before, after, ["name", "price", "notes"]);
    expect(diff).toEqual({
      name:  { from: "Old Name", to: "New Name" },
      price: { from: 100,        to: 150 },
    });
  });

  it("ignores unchanged fields", () => {
    const before = { a: 1, b: 2 };
    const after  = { a: 1, b: 2 };
    expect(diffObjects(before, after, ["a", "b"])).toEqual({});
  });

  it("detects null → value transition", () => {
    const before = { rate: null as number | null };
    const after  = { rate: 5000 };
    const diff = diffObjects(before as Record<string, unknown>, after as Record<string, unknown>, ["rate"]);
    expect(diff.rate).toEqual({ from: null, to: 5000 });
  });

  it("detects value → null transition", () => {
    const before = { rate: 5000 as number | null };
    const after  = { rate: null };
    const diff = diffObjects(before as Record<string, unknown>, after as Record<string, unknown>, ["rate"]);
    expect(diff.rate).toEqual({ from: 5000, to: null });
  });

  it("only watches the specified fields", () => {
    const before = { a: 1, b: 2, c: 3 };
    const after  = { a: 99, b: 99, c: 99 };
    // Only watch "a"
    const diff = diffObjects(before, after, ["a"]);
    expect(Object.keys(diff)).toEqual(["a"]);
  });

  it("skips fields absent from the after object", () => {
    const before = { a: 1, b: 2 };
    const after  = { a: 99 }; // b not present → not a change
    const diff = diffObjects(before, after as Partial<typeof before>, ["a", "b"]);
    expect(diff).toEqual({ a: { from: 1, to: 99 } });
  });

  it("handles boolean fields", () => {
    const before = { isActive: true };
    const after  = { isActive: false };
    const diff = diffObjects(before as Record<string, unknown>, after as Record<string, unknown>, ["isActive"]);
    expect(diff.isActive).toEqual({ from: true, to: false });
  });
});

// ─── logAudit ────────────────────────────────────────────────────────────────

describe("logAudit", () => {
  it("calls prisma.auditLog.create with correct fields", async () => {
    await logAudit({
      entityType: "InventoryItem",
      entityId:   "item-123",
      entityLabel: "Moving Head 300W",
      action:     "UPDATE",
      userId:     "user-1",
      changes:    { dailyRateAmount: { from: 10000, to: 15000 } },
    });
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType:  "InventoryItem",
          entityId:    "item-123",
          entityLabel: "Moving Head 300W",
          action:      "UPDATE",
          userId:      "user-1",
        }),
      })
    );
  });

  it("swallows DB errors without throwing", async () => {
    vi.mocked(prisma.auditLog.create).mockRejectedValueOnce(new Error("DB down"));
    await expect(
      logAudit({ entityType: "X", entityId: "1", action: "CREATE" })
    ).resolves.toBeUndefined();
  });

  it("works with no userId (system action)", async () => {
    await expect(
      logAudit({ entityType: "Project", entityId: "p-1", action: "STATUS_CHANGE" })
    ).resolves.toBeUndefined();
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: null }),
      })
    );
  });
});
