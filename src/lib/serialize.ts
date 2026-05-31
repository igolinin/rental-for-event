/**
 * Deep-convert Prisma `Decimal` values to plain numbers so a query result can
 * be passed from a Server Component to a Client Component (Next.js refuses to
 * serialize Decimal instances across that boundary).
 *
 * Dates and all other values are preserved as-is (Next supports Date).
 * The return type is kept identical to the input so existing client typings —
 * which still see the fields as `Decimal` — continue to compile; at runtime the
 * values are numbers, and the client code only ever wraps them in `Number(...)`.
 */

import { Prisma } from "@prisma/client";

function walk(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Prisma.Decimal.isDecimal(value)) return Number(value);
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(walk);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = walk((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function serializeDecimals<T>(value: T): T {
  return walk(value) as T;
}
