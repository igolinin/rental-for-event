/**
 * CSV utilities using papaparse.
 * Used for import/export of inventory items and crew roster.
 */

import Papa from "papaparse";

/** Parse a CSV string into an array of row objects keyed by header. */
export function parseCSV(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });
  return result.data;
}

/** Serialize an array of rows to a CSV string with a given header order. */
export function toCSV(
  rows: Record<string, unknown>[],
  headers: string[]
): string {
  return Papa.unparse({ fields: headers, data: rows.map((r) => headers.map((h) => r[h] ?? "")) });
}

/** Validate that a row has all required columns. Returns a list of missing fields. */
export function missingFields(
  row: Record<string, string>,
  required: string[]
): string[] {
  return required.filter((f) => !row[f]?.trim());
}
