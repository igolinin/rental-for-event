/**
 * Overtime calculation engine.
 *
 * Computes Regular / Overtime / Double-Time hour splits from raw timesheet
 * entries, based on configurable daily and weekly thresholds.
 *
 * Rates are snapshotted on approval — this module only handles hour allocation.
 */

import { differenceInMinutes } from "date-fns";

export interface OTPolicy {
  /** Hours per day before overtime kicks in (default: 8) */
  dailyOTThreshold: number;
  /** Hours per day before double-time kicks in (default: 12) */
  dailyDTThreshold: number;
  /** Total regular hours per week before weekly OT (default: 40) */
  weeklyOTThreshold: number;
}

export const DEFAULT_OT_POLICY: OTPolicy = {
  dailyOTThreshold: 8,
  dailyDTThreshold: 12,
  weeklyOTThreshold: 40,
};

export interface TimesheetEntry {
  id: string;
  clockIn: Date;
  clockOut: Date;
  breakMinutes: number;
}

export interface OTResult {
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  /** Total billable hours (regular + OT + DT) */
  totalHours: number;
}

/**
 * Calculate hour splits for a single shift entry.
 * Does NOT apply weekly threshold — use calculateWeeklyOT for a full week.
 *
 * @param entry - A single clock-in/clock-out record
 * @param policy - OT policy thresholds
 * @param weeklyRegularHoursUsed - Regular hours already consumed this week (for weekly OT calc)
 */
export function calculateShiftOT(
  entry: TimesheetEntry,
  policy: OTPolicy = DEFAULT_OT_POLICY,
  weeklyRegularHoursUsed = 0
): OTResult {
  const totalMinutes =
    differenceInMinutes(entry.clockOut, entry.clockIn) - entry.breakMinutes;
  const totalHours = Math.max(0, totalMinutes / 60);

  const dailyOTThreshold = policy.dailyOTThreshold;
  const dailyDTThreshold = policy.dailyDTThreshold;
  const weeklyOTThreshold = policy.weeklyOTThreshold;

  // First: apply daily DT threshold
  let dailyDoubleTime = 0;
  let hoursSubjectToOT = totalHours;

  if (totalHours > dailyDTThreshold) {
    dailyDoubleTime = totalHours - dailyDTThreshold;
    hoursSubjectToOT = dailyDTThreshold;
  }

  // Next: apply daily OT threshold
  let dailyOvertime = 0;
  let dailyRegular = hoursSubjectToOT;

  if (hoursSubjectToOT > dailyOTThreshold) {
    dailyOvertime = hoursSubjectToOT - dailyOTThreshold;
    dailyRegular = dailyOTThreshold;
  }

  // Finally: apply weekly threshold to the regular hours
  const weeklyRegularRemaining = Math.max(
    0,
    weeklyOTThreshold - weeklyRegularHoursUsed
  );

  let regularHours: number;
  let weeklyOvertime: number;

  if (dailyRegular <= weeklyRegularRemaining) {
    regularHours = dailyRegular;
    weeklyOvertime = 0;
  } else {
    regularHours = weeklyRegularRemaining;
    weeklyOvertime = dailyRegular - weeklyRegularRemaining;
  }

  const overtimeHours = dailyOvertime + weeklyOvertime;
  const doubleTimeHours = dailyDoubleTime;

  return {
    regularHours: round2(regularHours),
    overtimeHours: round2(overtimeHours),
    doubleTimeHours: round2(doubleTimeHours),
    totalHours: round2(totalHours),
  };
}

/**
 * Calculate OT splits for a set of entries within a work week,
 * processing them chronologically and tracking running weekly totals.
 */
export function calculateWeeklyOT(
  entries: TimesheetEntry[],
  policy: OTPolicy = DEFAULT_OT_POLICY
): Map<string, OTResult> {
  // Sort by clock-in time
  const sorted = [...entries].sort(
    (a, b) => a.clockIn.getTime() - b.clockIn.getTime()
  );

  const results = new Map<string, OTResult>();
  let weeklyRegularHoursUsed = 0;

  for (const entry of sorted) {
    const result = calculateShiftOT(entry, policy, weeklyRegularHoursUsed);
    results.set(entry.id, result);
    weeklyRegularHoursUsed += result.regularHours;
  }

  return results;
}

/**
 * Calculate the total dollar amount for a timesheet shift given rate amounts.
 * All amounts are in the smallest currency unit (cents).
 */
export function calculateShiftTotal(
  result: OTResult,
  regularRateAmount: number,
  overtimeRateAmount: number,
  doubleTimeRateAmount: number
): number {
  const regular = Math.round(result.regularHours * regularRateAmount);
  const overtime = Math.round(result.overtimeHours * overtimeRateAmount);
  const doubleTime = Math.round(result.doubleTimeHours * doubleTimeRateAmount);
  return regular + overtime + doubleTime;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
