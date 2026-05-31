import { describe, it, expect } from "vitest";
import {
  curveMultiplier,
  computeLineTotal,
  resolveTiers,
  effectivePerDay,
  type PricingTierLite,
} from "@/lib/pricing";

const STANDARD: PricingTierLite[] = [
  { minDays: 1, multiplier: 1.0 },
  { minDays: 2, multiplier: 1.8 },
  { minDays: 3, multiplier: 2.5 },
  { minDays: 7, multiplier: 3.0 },
  { minDays: 14, multiplier: 5.0 },
  { minDays: 30, multiplier: 9.0 },
];

describe("curveMultiplier — step-down lookup", () => {
  it("returns exact-match multiplier at a breakpoint", () => {
    expect(curveMultiplier(STANDARD, 7)).toBe(3.0);
    expect(curveMultiplier(STANDARD, 1)).toBe(1.0);
    expect(curveMultiplier(STANDARD, 30)).toBe(9.0);
  });

  it("steps down to the lower breakpoint between points", () => {
    // 5 days → uses the 3-day tier (2.5×)
    expect(curveMultiplier(STANDARD, 5)).toBe(2.5);
    // 10 days → uses the 7-day tier (3.0×)
    expect(curveMultiplier(STANDARD, 10)).toBe(3.0);
    // 20 days → uses the 14-day tier (5.0×)
    expect(curveMultiplier(STANDARD, 20)).toBe(5.0);
  });

  it("uses the smallest tier below the first breakpoint", () => {
    // 0 days (degenerate) → smallest tier (minDays 1, 1.0×)
    expect(curveMultiplier(STANDARD, 0)).toBe(1.0);
  });

  it("uses the largest tier above the last breakpoint", () => {
    expect(curveMultiplier(STANDARD, 365)).toBe(9.0);
  });

  it("is order-independent (sorts internally)", () => {
    const shuffled = [...STANDARD].reverse();
    expect(curveMultiplier(shuffled, 5)).toBe(2.5);
  });

  it("empty/null tiers → linear fallback (returns durationDays)", () => {
    expect(curveMultiplier([], 5)).toBe(5);
    expect(curveMultiplier(null, 12)).toBe(12);
    expect(curveMultiplier(undefined, 3)).toBe(3);
  });
});

describe("computeLineTotal", () => {
  it("applies the curve: dailyRate × multiplier × qty", () => {
    // $100/day, 7 days, qty 2 → 10000 × 3.0 × 2 = 60000
    expect(computeLineTotal(10000, 7, 2, STANDARD, "DAILY")).toBe(60000);
  });

  it("FLAT bypasses duration and curve", () => {
    // flat: dailyRate × qty regardless of days/curve
    expect(computeLineTotal(10000, 30, 3, STANDARD, "FLAT")).toBe(30000);
  });

  it("no tiers → linear fallback equals legacy formula", () => {
    // legacy: rate × days × qty
    expect(computeLineTotal(10000, 5, 2, null, "DAILY")).toBe(100000);
    expect(computeLineTotal(10000, 5, 2, null, "DAILY")).toBe(10000 * 5 * 2);
  });

  it("rounds to whole cents", () => {
    // 333 × 1.8 × 1 = 599.4 → 599
    expect(computeLineTotal(333, 2, 1, STANDARD, "DAILY")).toBe(599);
  });

  it("WEEKLY rate type still applies the curve on day duration", () => {
    expect(computeLineTotal(10000, 14, 1, STANDARD, "WEEKLY")).toBe(50000);
  });
});

describe("monotonicity — longer rental is cheaper per day at the breakpoints", () => {
  it("effective per-day at each tier breakpoint is non-increasing", () => {
    // A well-designed rate card guarantees the per-day rate drops as you move
    // to a *longer* tier. (Between breakpoints a step-down card naturally
    // sawtooths — that is expected and not asserted here.)
    const breakpoints = STANDARD.map((t) => t.minDays);
    let prev = Infinity;
    for (const d of breakpoints) {
      const perDay = effectivePerDay(10000, d, STANDARD);
      expect(perDay).toBeLessThanOrEqual(prev);
      prev = perDay;
    }
  });

  it("within a tier, per-day decreases as days increase (step-down behaviour)", () => {
    // Days 7..13 all use the 7-day tier (3.0×), so total is flat and per-day falls
    const d7 = effectivePerDay(10000, 7, STANDARD);
    const d13 = effectivePerDay(10000, 13, STANDARD);
    expect(d13).toBeLessThan(d7);
  });

  it("effectivePerDay returns 0 for non-positive duration", () => {
    expect(effectivePerDay(10000, 0, STANDARD)).toBe(0);
  });
});

describe("resolveTiers — priority order", () => {
  const line: PricingTierLite[] = [{ minDays: 1, multiplier: 1 }];
  const item: PricingTierLite[] = [{ minDays: 1, multiplier: 2 }];
  const def: PricingTierLite[] = [{ minDays: 1, multiplier: 3 }];

  it("line override wins over item and default", () => {
    expect(resolveTiers(line, item, def)).toBe(line);
  });

  it("item profile wins over default when no line override", () => {
    expect(resolveTiers(null, item, def)).toBe(item);
  });

  it("falls back to default when no line or item", () => {
    expect(resolveTiers(null, null, def)).toBe(def);
  });

  it("returns null when nothing is set", () => {
    expect(resolveTiers(null, null, null)).toBeNull();
  });

  it("treats empty arrays as absent", () => {
    expect(resolveTiers([], [], def)).toBe(def);
  });
});
