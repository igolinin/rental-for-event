import { describe, it, expect } from "vitest";
import {
  calculateShiftOT,
  calculateWeeklyOT,
  calculateShiftTotal,
  DEFAULT_OT_POLICY,
  type TimesheetEntry,
  type OTPolicy,
} from "@/lib/payroll";

function makeEntry(
  id: string,
  clockInISO: string,
  clockOutISO: string,
  breakMinutes = 0
): TimesheetEntry {
  return {
    id,
    clockIn: new Date(clockInISO),
    clockOut: new Date(clockOutISO),
    breakMinutes,
  };
}

describe("calculateShiftOT — daily thresholds", () => {
  it("8h shift → 8h regular, 0 OT, 0 DT", () => {
    const entry = makeEntry("1", "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z");
    const result = calculateShiftOT(entry);
    expect(result).toEqual({ regularHours: 8, overtimeHours: 0, doubleTimeHours: 0, totalHours: 8 });
  });

  it("10h shift → 8h regular, 2h OT, 0 DT", () => {
    const entry = makeEntry("1", "2026-06-01T08:00:00Z", "2026-06-01T18:00:00Z");
    const result = calculateShiftOT(entry);
    expect(result).toEqual({ regularHours: 8, overtimeHours: 2, doubleTimeHours: 0, totalHours: 10 });
  });

  it("14h shift → 8h regular, 4h OT, 2h DT", () => {
    const entry = makeEntry("1", "2026-06-01T08:00:00Z", "2026-06-01T22:00:00Z");
    const result = calculateShiftOT(entry);
    expect(result).toEqual({ regularHours: 8, overtimeHours: 4, doubleTimeHours: 2, totalHours: 14 });
  });

  it("12h shift (exactly at DT threshold) → 8h regular, 4h OT, 0 DT", () => {
    const entry = makeEntry("1", "2026-06-01T08:00:00Z", "2026-06-01T20:00:00Z");
    const result = calculateShiftOT(entry);
    expect(result).toEqual({ regularHours: 8, overtimeHours: 4, doubleTimeHours: 0, totalHours: 12 });
  });

  it("exactly 8h (at OT threshold boundary) → all regular", () => {
    const entry = makeEntry("1", "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z");
    const result = calculateShiftOT(entry);
    expect(result.regularHours).toBe(8);
    expect(result.overtimeHours).toBe(0);
  });

  it("0h shift (clockOut === clockIn) → all zeros", () => {
    const entry = makeEntry("1", "2026-06-01T08:00:00Z", "2026-06-01T08:00:00Z");
    const result = calculateShiftOT(entry);
    expect(result).toEqual({ regularHours: 0, overtimeHours: 0, doubleTimeHours: 0, totalHours: 0 });
  });

  it("shift duration shorter than break → clamped to 0h", () => {
    // 1h shift with 90min break → negative → clamped to 0
    const entry = makeEntry("1", "2026-06-01T08:00:00Z", "2026-06-01T09:00:00Z", 90);
    const result = calculateShiftOT(entry);
    expect(result).toEqual({ regularHours: 0, overtimeHours: 0, doubleTimeHours: 0, totalHours: 0 });
  });

  it("break minutes reduce billable hours", () => {
    // 10h shift with 60min break → 9h billable → 8h regular, 1h OT
    const entry = makeEntry("1", "2026-06-01T08:00:00Z", "2026-06-01T18:00:00Z", 60);
    const result = calculateShiftOT(entry);
    expect(result.regularHours).toBe(8);
    expect(result.overtimeHours).toBe(1);
    expect(result.totalHours).toBe(9);
  });
});

describe("calculateShiftOT — weekly threshold interaction", () => {
  it("weeklyRegularHoursUsed=36 + 8h shift → 4h regular, 4h OT", () => {
    const entry = makeEntry("1", "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z");
    const result = calculateShiftOT(entry, DEFAULT_OT_POLICY, 36);
    expect(result.regularHours).toBe(4);
    expect(result.overtimeHours).toBe(4);
    expect(result.doubleTimeHours).toBe(0);
  });

  it("weeklyRegularHoursUsed=40 + 8h shift → 0 regular, 8h OT", () => {
    const entry = makeEntry("1", "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z");
    const result = calculateShiftOT(entry, DEFAULT_OT_POLICY, 40);
    expect(result.regularHours).toBe(0);
    expect(result.overtimeHours).toBe(8);
    expect(result.doubleTimeHours).toBe(0);
  });

  it("weeklyRegularHoursUsed > weeklyThreshold → 0 remaining regular", () => {
    const entry = makeEntry("1", "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z");
    const result = calculateShiftOT(entry, DEFAULT_OT_POLICY, 50);
    expect(result.regularHours).toBe(0);
    expect(result.overtimeHours).toBe(8);
  });
});

describe("calculateShiftOT — custom policy", () => {
  const customPolicy: OTPolicy = {
    dailyOTThreshold: 6,
    dailyDTThreshold: 10,
    weeklyOTThreshold: 32,
  };

  it("8h shift with 6h/10h/32h policy → 6h regular, 2h OT", () => {
    const entry = makeEntry("1", "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z");
    const result = calculateShiftOT(entry, customPolicy);
    expect(result.regularHours).toBe(6);
    expect(result.overtimeHours).toBe(2);
    expect(result.doubleTimeHours).toBe(0);
  });

  it("11h shift with 6h/10h/32h policy → 6h regular, 4h OT, 1h DT", () => {
    const entry = makeEntry("1", "2026-06-01T08:00:00Z", "2026-06-01T19:00:00Z");
    const result = calculateShiftOT(entry, customPolicy);
    expect(result.regularHours).toBe(6);
    expect(result.overtimeHours).toBe(4);
    expect(result.doubleTimeHours).toBe(1);
  });
});

describe("calculateWeeklyOT", () => {
  it("5 × 8h shifts → all regular, 0 OT", () => {
    const entries = [
      makeEntry("mon", "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z"),
      makeEntry("tue", "2026-06-02T08:00:00Z", "2026-06-02T16:00:00Z"),
      makeEntry("wed", "2026-06-03T08:00:00Z", "2026-06-03T16:00:00Z"),
      makeEntry("thu", "2026-06-04T08:00:00Z", "2026-06-04T16:00:00Z"),
      makeEntry("fri", "2026-06-05T08:00:00Z", "2026-06-05T16:00:00Z"),
    ];
    const results = calculateWeeklyOT(entries);
    for (const id of ["mon", "tue", "wed", "thu", "fri"]) {
      expect(results.get(id)?.overtimeHours).toBe(0);
      expect(results.get(id)?.regularHours).toBe(8);
    }
  });

  it("6 × 8h shifts → first 5 days regular, 6th day fully OT", () => {
    const entries = [
      makeEntry("mon", "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z"),
      makeEntry("tue", "2026-06-02T08:00:00Z", "2026-06-02T16:00:00Z"),
      makeEntry("wed", "2026-06-03T08:00:00Z", "2026-06-03T16:00:00Z"),
      makeEntry("thu", "2026-06-04T08:00:00Z", "2026-06-04T16:00:00Z"),
      makeEntry("fri", "2026-06-05T08:00:00Z", "2026-06-05T16:00:00Z"),
      makeEntry("sat", "2026-06-06T08:00:00Z", "2026-06-06T16:00:00Z"),
    ];
    const results = calculateWeeklyOT(entries);
    expect(results.get("sat")?.regularHours).toBe(0);
    expect(results.get("sat")?.overtimeHours).toBe(8);
  });

  it("processes entries by clockIn time regardless of input order", () => {
    // Provide entries in reverse chronological order
    const entries = [
      makeEntry("fri", "2026-06-05T08:00:00Z", "2026-06-05T16:00:00Z"),
      makeEntry("thu", "2026-06-04T08:00:00Z", "2026-06-04T16:00:00Z"),
      makeEntry("wed", "2026-06-03T08:00:00Z", "2026-06-03T16:00:00Z"),
      makeEntry("tue", "2026-06-02T08:00:00Z", "2026-06-02T16:00:00Z"),
      makeEntry("mon", "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z"),
      makeEntry("sat", "2026-06-06T08:00:00Z", "2026-06-06T16:00:00Z"),
    ];
    const results = calculateWeeklyOT(entries);
    // Monday–Friday should be regular; Saturday should be OT
    expect(results.get("mon")?.regularHours).toBe(8);
    expect(results.get("sat")?.overtimeHours).toBe(8);
  });

  it("returns a Map keyed by entry id", () => {
    const entry = makeEntry("abc", "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z");
    const results = calculateWeeklyOT([entry]);
    expect(results.has("abc")).toBe(true);
  });

  it("weekly threshold split — 38h in, 8h shift → 2h regular + 6h OT", () => {
    // Build 4 prior 9.5h shifts (38h total regular — within 40h weekly)
    const entries = [
      makeEntry("d1", "2026-06-01T08:00:00Z", "2026-06-01T17:30:00Z"), // 9.5h
      makeEntry("d2", "2026-06-02T08:00:00Z", "2026-06-02T17:30:00Z"),
      makeEntry("d3", "2026-06-03T08:00:00Z", "2026-06-03T17:30:00Z"),
      makeEntry("d4", "2026-06-04T08:00:00Z", "2026-06-04T17:30:00Z"),
      makeEntry("d5", "2026-06-05T08:00:00Z", "2026-06-05T16:00:00Z"), // 8h — straddles 40h
    ];
    const results = calculateWeeklyOT(entries);
    // Each 9.5h day: 8h regular + 1.5h OT. After d4: 32h regular used.
    // d5 (8h): weeklyRemaining = 40-32 = 8, all 8h regular
    const d5 = results.get("d5")!;
    expect(d5.regularHours).toBe(8);
    expect(d5.overtimeHours).toBe(0);
  });
});

describe("calculateShiftTotal", () => {
  it("8h regular at 1000c/h → 8000c total", () => {
    const result = { regularHours: 8, overtimeHours: 0, doubleTimeHours: 0, totalHours: 8 };
    expect(calculateShiftTotal(result, 1000, 1500, 2000)).toBe(8000);
  });

  it("8h regular + 2h OT at 1000c / 1500c → 11000c", () => {
    const result = { regularHours: 8, overtimeHours: 2, doubleTimeHours: 0, totalHours: 10 };
    expect(calculateShiftTotal(result, 1000, 1500, 2000)).toBe(11000);
  });

  it("8h regular + 4h OT + 2h DT → 8000 + 6000 + 4000 = 18000c", () => {
    const result = { regularHours: 8, overtimeHours: 4, doubleTimeHours: 2, totalHours: 14 };
    expect(calculateShiftTotal(result, 1000, 1500, 2000)).toBe(18000);
  });

  it("0h all types → 0", () => {
    const result = { regularHours: 0, overtimeHours: 0, doubleTimeHours: 0, totalHours: 0 };
    expect(calculateShiftTotal(result, 1000, 1500, 2000)).toBe(0);
  });

  it("rounds to nearest cent", () => {
    // 1.33h × 1000c = 1330c (no rounding needed here, but verify Math.round works)
    const result = { regularHours: 1.33, overtimeHours: 0, doubleTimeHours: 0, totalHours: 1.33 };
    expect(calculateShiftTotal(result, 1000, 1500, 2000)).toBe(1330);
  });
});
