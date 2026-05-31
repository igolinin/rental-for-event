import { describe, it, expect } from "vitest";
import {
  hasDiscount,
  computeLineDiscounts,
  type DiscountLineInput,
  type DiscountSpec,
} from "@/lib/discounts";

function line(
  id: string,
  lineTotal: number,
  categoryId: string,
  lineDiscount: DiscountSpec | null = null,
  locked = false
): DiscountLineInput {
  return { id, lineTotal, categoryId, locked, lineDiscount };
}

describe("hasDiscount", () => {
  it("true for positive percent or fixed", () => {
    expect(hasDiscount({ percent: 0.1 })).toBe(true);
    expect(hasDiscount({ fixed: 500 })).toBe(true);
  });
  it("false for null/zero/empty", () => {
    expect(hasDiscount(null)).toBe(false);
    expect(hasDiscount({ percent: 0, fixed: 0 })).toBe(false);
    expect(hasDiscount({})).toBe(false);
  });
});

describe("computeLineDiscounts — per-line percent & fixed", () => {
  it("line percent → lineTotal × pct", () => {
    const r = computeLineDiscounts([line("a", 10000, "audio", { percent: 0.15 })], {}, null);
    expect(r.perLine.a).toBe(1500);
    expect(r.total).toBe(1500);
  });

  it("line fixed is capped at lineTotal", () => {
    const r = computeLineDiscounts([line("a", 1000, "audio", { fixed: 5000 })], {}, null);
    expect(r.perLine.a).toBe(1000);
  });
});

describe("computeLineDiscounts — most-specific wins", () => {
  const cat: Record<string, DiscountSpec> = { lighting: { percent: 0.2 } };
  const proj: DiscountSpec = { percent: 0.1 };

  it("line discount beats category and project", () => {
    const r = computeLineDiscounts([line("a", 10000, "lighting", { percent: 0.15 })], cat, proj);
    expect(r.perLine.a).toBe(1500); // 15%, not 20% or 10%
  });

  it("category discount beats project when no line discount", () => {
    const r = computeLineDiscounts([line("a", 10000, "lighting")], cat, proj);
    expect(r.perLine.a).toBe(2000); // 20%
  });

  it("project discount applies when neither line nor category set", () => {
    const r = computeLineDiscounts([line("a", 10000, "audio")], cat, proj);
    expect(r.perLine.a).toBe(1000); // 10%
  });

  it("no discounts anywhere → zero", () => {
    const r = computeLineDiscounts([line("a", 10000, "audio")], {}, null);
    expect(r.perLine.a).toBe(0);
    expect(r.total).toBe(0);
  });
});

describe("computeLineDiscounts — no-discount lock", () => {
  it("locked line gets zero even with line/category/project discounts", () => {
    const r = computeLineDiscounts(
      [line("a", 10000, "lighting", { percent: 0.5 }, true)],
      { lighting: { percent: 0.2 } },
      { percent: 0.1 }
    );
    expect(r.perLine.a).toBe(0);
  });
});

describe("computeLineDiscounts — fixed distribution", () => {
  it("project fixed distributes proportionally across project-source lines", () => {
    // two project-source lines 6000 / 4000, $1000 project fixed
    const r = computeLineDiscounts(
      [line("a", 6000, "audio"), line("b", 4000, "lighting")],
      {},
      { fixed: 1000 }
    );
    expect(r.perLine.a).toBe(600);
    expect(r.perLine.b).toBe(400);
    expect(r.total).toBe(1000);
  });

  it("project fixed excludes lines covered by a more-specific discount", () => {
    // line a has its own discount → excluded from project-fixed pool
    const r = computeLineDiscounts(
      [line("a", 6000, "audio", { percent: 0.1 }), line("b", 4000, "lighting")],
      {},
      { fixed: 1000 }
    );
    expect(r.perLine.a).toBe(600); // its own 10%
    expect(r.perLine.b).toBe(1000); // whole project fixed lands on b (only project-source line)
  });

  it("category fixed distributes only across that category's lines", () => {
    const r = computeLineDiscounts(
      [line("a", 5000, "lighting"), line("b", 5000, "lighting"), line("c", 5000, "audio")],
      { lighting: { fixed: 2000 } },
      null
    );
    expect(r.perLine.a).toBe(1000);
    expect(r.perLine.b).toBe(1000);
    expect(r.perLine.c).toBe(0); // audio not covered
  });

  it("fixed amount never exceeds the covered base", () => {
    const r = computeLineDiscounts([line("a", 1000, "audio")], {}, { fixed: 99999 });
    expect(r.perLine.a).toBe(1000);
    expect(r.total).toBe(1000);
  });

  it("total always equals the sum of per-line discounts", () => {
    const r = computeLineDiscounts(
      [line("a", 3333, "audio"), line("b", 3333, "audio"), line("c", 3334, "audio")],
      {},
      { fixed: 1000 }
    );
    const sum = r.perLine.a + r.perLine.b + r.perLine.c;
    expect(r.total).toBe(sum);
    expect(r.total).toBe(1000); // remainder reconciled
  });
});

describe("computeLineDiscounts — mixed levels", () => {
  it("combines line, category, and project sources across different lines", () => {
    const r = computeLineDiscounts(
      [
        line("a", 10000, "lighting", { percent: 0.15 }), // line 15% = 1500
        line("b", 10000, "lighting"),                     // category 20% = 2000
        line("c", 10000, "audio"),                        // project 10% = 1000
      ],
      { lighting: { percent: 0.2 } },
      { percent: 0.1 }
    );
    expect(r.perLine.a).toBe(1500);
    expect(r.perLine.b).toBe(2000);
    expect(r.perLine.c).toBe(1000);
    expect(r.total).toBe(4500);
  });
});
