import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid } from "nanoid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a human-readable reference code.
 * e.g. "PRJ-2024-0087", "INV-2024-0042"
 */
export function generateRefCode(prefix: string): string {
  const year = new Date().getFullYear();
  const id = nanoid(6).toUpperCase();
  return `${prefix}-${year}-${id}`;
}

/**
 * Generate a simple sequential-style code without year.
 * e.g. "CRW-AB12XY", "CLI-ZK99PM"
 */
export function generateShortCode(prefix: string): string {
  const id = nanoid(6).toUpperCase();
  return `${prefix}-${id}`;
}

/**
 * Format a date to a readable string.
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a datetime to a readable string.
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
