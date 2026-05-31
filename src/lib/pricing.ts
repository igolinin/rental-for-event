/**
 * Duration-based pricing curves (rate cards).
 *
 * A pricing profile is a set of tiers: (minDays → multiplier of the daily rate).
 * For a rental of N days, the price is dailyRate × multiplier(N) × quantity,
 * where multiplier(N) is the multiplier of the highest tier whose minDays ≤ N
 * (step-down between breakpoints).
 *
 * Longer rentals get a sub-linear multiplier, so the effective per-day / per-week
 * price decreases with duration.
 *
 * Pure functions — reused by the kit list, project P&L, and invoice prefill.
 */

export interface PricingTierLite {
  minDays: number;
  multiplier: number;
}

export type LineRateType = "DAILY" | "WEEKLY" | "FLAT";

/**
 * Resolve the multiplier for a given duration using step-down lookup.
 * Empty/missing tiers → linear fallback (returns durationDays), which reproduces
 * the legacy flat formula (dailyRate × days × qty).
 */
export function curveMultiplier(
  tiers: PricingTierLite[] | null | undefined,
  durationDays: number
): number {
  if (!tiers || tiers.length === 0) return durationDays;

  const sorted = [...tiers].sort((a, b) => a.minDays - b.minDays);
  let chosen = sorted[0];
  for (const tier of sorted) {
    if (tier.minDays <= durationDays) chosen = tier;
    else break;
  }
  return chosen.multiplier;
}

/**
 * Compute a line total in cents.
 *   FLAT      → unitRateAmount × quantity (duration & curve ignored)
 *   no tiers  → unitRateAmount × durationDays × quantity (legacy linear)
 *   with tiers→ unitRateAmount × curveMultiplier(tiers, durationDays) × quantity
 */
export function computeLineTotal(
  unitRateAmount: number,
  durationDays: number,
  quantity: number,
  tiers: PricingTierLite[] | null | undefined,
  rateType: LineRateType = "DAILY"
): number {
  if (rateType === "FLAT") {
    return Math.round(unitRateAmount * quantity);
  }
  const mult = curveMultiplier(tiers, durationDays);
  return Math.round(unitRateAmount * mult * quantity);
}

/**
 * Resolve which tier set applies, in priority order:
 *   line override → item profile → system default → null (linear fallback)
 */
export function resolveTiers(
  lineTiers: PricingTierLite[] | null | undefined,
  itemTiers: PricingTierLite[] | null | undefined,
  defaultTiers: PricingTierLite[] | null | undefined
): PricingTierLite[] | null {
  if (lineTiers && lineTiers.length) return lineTiers;
  if (itemTiers && itemTiers.length) return itemTiers;
  if (defaultTiers && defaultTiers.length) return defaultTiers;
  return null;
}

/**
 * Effective per-day price for a duration (cents), for preview/display.
 */
export function effectivePerDay(
  dailyRateAmount: number,
  durationDays: number,
  tiers: PricingTierLite[] | null | undefined
): number {
  if (durationDays <= 0) return 0;
  const total = computeLineTotal(dailyRateAmount, durationDays, 1, tiers, "DAILY");
  return Math.round(total / durationDays);
}
