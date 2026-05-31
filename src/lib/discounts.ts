/**
 * Flexible discount resolution.
 *
 * Discounts can be set at three scopes — line, group (inventory category),
 * and project — as a percentage (0..1) or a fixed cent amount. Resolution is
 * "most-specific wins" per line: line → category → project. Items flagged
 * `noDiscount` (locked) are never discounted at any level.
 *
 * Percentage discounts apply per line. Fixed discounts at the category/project
 * level are distributed proportionally (by line total) across the lines they
 * cover, so the total reduction equals the configured fixed amount.
 *
 * Runs AFTER computeLineTotal (src/lib/pricing.ts) on the curve-applied gross.
 */

export interface DiscountSpec {
  percent?: number | null; // 0..1
  fixed?: number | null; // cents
}

export interface DiscountLineInput {
  id: string;
  lineTotal: number; // cents, curve-applied gross
  categoryId: string;
  locked: boolean; // item.noDiscount
  lineDiscount: DiscountSpec | null;
}

type Source = "LINE" | "CATEGORY" | "PROJECT" | "NONE";

export function hasDiscount(d: DiscountSpec | null | undefined): boolean {
  if (!d) return false;
  return (d.percent != null && d.percent > 0) || (d.fixed != null && d.fixed > 0);
}

export function computeLineDiscounts(
  lines: DiscountLineInput[],
  categoryDiscounts: Record<string, DiscountSpec>,
  projectDiscount: DiscountSpec | null
): { perLine: Record<string, number>; total: number } {
  const perLine: Record<string, number> = {};
  const source: Record<string, Source> = {};

  // 1. Determine each line's discount source (most specific wins).
  for (const line of lines) {
    perLine[line.id] = 0;
    if (line.locked) {
      source[line.id] = "NONE";
      continue;
    }
    if (hasDiscount(line.lineDiscount)) source[line.id] = "LINE";
    else if (hasDiscount(categoryDiscounts[line.categoryId])) source[line.id] = "CATEGORY";
    else if (hasDiscount(projectDiscount)) source[line.id] = "PROJECT";
    else source[line.id] = "NONE";
  }

  // 2. Percentage discounts + line-level fixed (applied directly per line).
  for (const line of lines) {
    const src = source[line.id];
    if (src === "NONE") continue;

    const spec =
      src === "LINE"
        ? line.lineDiscount!
        : src === "CATEGORY"
        ? categoryDiscounts[line.categoryId]
        : projectDiscount!;

    if (spec.percent != null && spec.percent > 0) {
      perLine[line.id] = clampDiscount(Math.round(line.lineTotal * spec.percent), line.lineTotal);
    } else if (src === "LINE" && spec.fixed != null && spec.fixed > 0) {
      perLine[line.id] = clampDiscount(spec.fixed, line.lineTotal);
    }
    // category/project fixed handled in step 3
  }

  // 3. Distribute category-level fixed amounts proportionally.
  const catFixedLines: Record<string, DiscountLineInput[]> = {};
  for (const line of lines) {
    if (source[line.id] !== "CATEGORY") continue;
    const spec = categoryDiscounts[line.categoryId];
    if (spec.fixed != null && spec.fixed > 0 && !(spec.percent != null && spec.percent > 0)) {
      (catFixedLines[line.categoryId] ??= []).push(line);
    }
  }
  for (const [categoryId, group] of Object.entries(catFixedLines)) {
    distributeFixed(group, categoryDiscounts[categoryId].fixed!, perLine);
  }

  // 4. Distribute project-level fixed amount proportionally across project-source lines.
  if (projectDiscount?.fixed != null && projectDiscount.fixed > 0 && !(projectDiscount.percent != null && projectDiscount.percent > 0)) {
    const group = lines.filter((l) => source[l.id] === "PROJECT");
    distributeFixed(group, projectDiscount.fixed, perLine);
  }

  const total = Object.values(perLine).reduce((s, v) => s + v, 0);
  return { perLine, total };
}

function clampDiscount(amount: number, lineTotal: number): number {
  return Math.max(0, Math.min(amount, lineTotal));
}

/**
 * Distribute a fixed cent amount across lines proportional to lineTotal,
 * never exceeding each line's total. Remainder from rounding goes to the
 * largest line so the sum matches the target (capped by available room).
 */
function distributeFixed(
  group: DiscountLineInput[],
  fixed: number,
  perLine: Record<string, number>
): void {
  const base = group.reduce((s, l) => s + l.lineTotal, 0);
  if (base <= 0) return;
  const target = Math.min(fixed, base);

  let allocated = 0;
  const shares = group.map((line) => {
    const share = clampDiscount(Math.round((line.lineTotal / base) * target), line.lineTotal);
    perLine[line.id] = share;
    allocated += share;
    return line;
  });

  // Reconcile rounding remainder onto lines with spare room (largest first).
  let remainder = target - allocated;
  if (remainder !== 0) {
    const ordered = [...shares].sort((a, b) => b.lineTotal - a.lineTotal);
    for (const line of ordered) {
      if (remainder === 0) break;
      const room = line.lineTotal - perLine[line.id];
      const adj = remainder > 0 ? Math.min(remainder, room) : Math.max(remainder, -perLine[line.id]);
      perLine[line.id] += adj;
      remainder -= adj;
    }
  }
}
