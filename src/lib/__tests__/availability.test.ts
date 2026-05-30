import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getAvailableQuantity, isSerializedUnitAvailable } from "@/lib/availability";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    inventoryItem: { findUnique: vi.fn() },
    projectEquipmentAllocation: { findMany: vi.fn(), findFirst: vi.fn() },
    projectEquipmentItem: { findMany: vi.fn() },
    serializedUnit: { findUnique: vi.fn() },
  },
}));

const START = new Date("2026-06-01T00:00:00Z");
const END = new Date("2026-06-05T00:00:00Z");

function serializedItem(units: Array<{ id: string; status: string }>) {
  return {
    id: "item-1",
    trackingMode: "SERIALIZED",
    isActive: true,
    totalQuantity: 0,
    serializedUnits: units,
  };
}

function bulkItem(totalQuantity: number) {
  return {
    id: "item-1",
    trackingMode: "BULK",
    isActive: true,
    totalQuantity,
    serializedUnits: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAvailableQuantity — SERIALIZED", () => {
  it("one AVAILABLE unit, no allocations → 1 available", async () => {
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(
      serializedItem([{ id: "unit-1", status: "AVAILABLE" }]) as any
    );
    vi.mocked(prisma.projectEquipmentAllocation.findMany).mockResolvedValue([]);

    expect(await getAvailableQuantity("item-1", START, END)).toBe(1);
  });

  it("IN_REPAIR unit → not counted", async () => {
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(
      serializedItem([
        { id: "unit-1", status: "AVAILABLE" },
        { id: "unit-2", status: "IN_REPAIR" },
      ]) as any
    );
    vi.mocked(prisma.projectEquipmentAllocation.findMany).mockResolvedValue([]);

    expect(await getAvailableQuantity("item-1", START, END)).toBe(1);
  });

  it("RETIRED unit → not counted", async () => {
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(
      serializedItem([
        { id: "unit-1", status: "AVAILABLE" },
        { id: "unit-2", status: "RETIRED" },
      ]) as any
    );
    vi.mocked(prisma.projectEquipmentAllocation.findMany).mockResolvedValue([]);

    expect(await getAvailableQuantity("item-1", START, END)).toBe(1);
  });

  it("unit allocated to overlapping project → not counted", async () => {
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(
      serializedItem([{ id: "unit-1", status: "AVAILABLE" }]) as any
    );
    vi.mocked(prisma.projectEquipmentAllocation.findMany).mockResolvedValue([
      { serializedUnitId: "unit-1" },
    ] as any);

    expect(await getAvailableQuantity("item-1", START, END)).toBe(0);
  });

  it("3 units, 1 allocated, 1 IN_REPAIR → 1 available", async () => {
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(
      serializedItem([
        { id: "unit-1", status: "AVAILABLE" },
        { id: "unit-2", status: "AVAILABLE" },
        { id: "unit-3", status: "IN_REPAIR" },
      ]) as any
    );
    vi.mocked(prisma.projectEquipmentAllocation.findMany).mockResolvedValue([
      { serializedUnitId: "unit-1" },
    ] as any);

    expect(await getAvailableQuantity("item-1", START, END)).toBe(1);
  });

  it("inactive item → 0 available", async () => {
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue({
      ...serializedItem([{ id: "unit-1", status: "AVAILABLE" }]),
      isActive: false,
    } as any);

    expect(await getAvailableQuantity("item-1", START, END)).toBe(0);
  });

  it("item not found → 0 available", async () => {
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(null);

    expect(await getAvailableQuantity("item-1", START, END)).toBe(0);
  });

  it("excludeProjectId is forwarded to allocation query", async () => {
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(
      serializedItem([{ id: "unit-1", status: "AVAILABLE" }]) as any
    );
    vi.mocked(prisma.projectEquipmentAllocation.findMany).mockResolvedValue([]);

    await getAvailableQuantity("item-1", START, END, "project-99");

    expect(vi.mocked(prisma.projectEquipmentAllocation.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectEquipmentItem: expect.objectContaining({
            project: expect.objectContaining({
              id: { not: "project-99" },
            }),
          }),
        }),
      })
    );
  });
});

describe("getAvailableQuantity — BULK", () => {
  it("totalQuantity=50, no allocations → 50 available", async () => {
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(bulkItem(50) as any);
    vi.mocked(prisma.projectEquipmentItem.findMany).mockResolvedValue([]);

    expect(await getAvailableQuantity("item-1", START, END)).toBe(50);
  });

  it("totalQuantity=50, allocated=30 → 20 available", async () => {
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(bulkItem(50) as any);
    vi.mocked(prisma.projectEquipmentItem.findMany).mockResolvedValue([
      { quantityNeeded: 20 },
      { quantityNeeded: 10 },
    ] as any);

    expect(await getAvailableQuantity("item-1", START, END)).toBe(20);
  });

  it("totalQuantity=50, allocated=50 → 0 (not negative)", async () => {
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(bulkItem(50) as any);
    vi.mocked(prisma.projectEquipmentItem.findMany).mockResolvedValue([
      { quantityNeeded: 50 },
    ] as any);

    expect(await getAvailableQuantity("item-1", START, END)).toBe(0);
  });

  it("totalQuantity=10, allocated=15 → clamped to 0", async () => {
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(bulkItem(10) as any);
    vi.mocked(prisma.projectEquipmentItem.findMany).mockResolvedValue([
      { quantityNeeded: 15 },
    ] as any);

    expect(await getAvailableQuantity("item-1", START, END)).toBe(0);
  });

  it("excludeProjectId forwarded to line-item query", async () => {
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(bulkItem(50) as any);
    vi.mocked(prisma.projectEquipmentItem.findMany).mockResolvedValue([]);

    await getAvailableQuantity("item-1", START, END, "project-99");

    expect(vi.mocked(prisma.projectEquipmentItem.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project: expect.objectContaining({
            id: { not: "project-99" },
          }),
        }),
      })
    );
  });
});

describe("isSerializedUnitAvailable", () => {
  it("AVAILABLE unit with no allocations → true", async () => {
    vi.mocked(prisma.serializedUnit.findUnique).mockResolvedValue({
      id: "unit-1",
      status: "AVAILABLE",
    } as any);
    vi.mocked(prisma.projectEquipmentAllocation.findFirst).mockResolvedValue(null);

    expect(await isSerializedUnitAvailable("unit-1", START, END)).toBe(true);
  });

  it("IN_REPAIR unit → false (no DB allocation check needed)", async () => {
    vi.mocked(prisma.serializedUnit.findUnique).mockResolvedValue({
      id: "unit-1",
      status: "IN_REPAIR",
    } as any);

    expect(await isSerializedUnitAvailable("unit-1", START, END)).toBe(false);
  });

  it("RETIRED unit → false", async () => {
    vi.mocked(prisma.serializedUnit.findUnique).mockResolvedValue({
      id: "unit-1",
      status: "RETIRED",
    } as any);

    expect(await isSerializedUnitAvailable("unit-1", START, END)).toBe(false);
  });

  it("unit allocated to overlapping project → false", async () => {
    vi.mocked(prisma.serializedUnit.findUnique).mockResolvedValue({
      id: "unit-1",
      status: "AVAILABLE",
    } as any);
    vi.mocked(prisma.projectEquipmentAllocation.findFirst).mockResolvedValue({
      id: "alloc-1",
    } as any);

    expect(await isSerializedUnitAvailable("unit-1", START, END)).toBe(false);
  });

  it("unit not found → false", async () => {
    vi.mocked(prisma.serializedUnit.findUnique).mockResolvedValue(null);

    expect(await isSerializedUnitAvailable("unit-1", START, END)).toBe(false);
  });
});
