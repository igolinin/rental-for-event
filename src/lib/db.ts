/**
 * Thin neverthrow wrapper around Prisma calls.
 * Every server action's database work goes through safeDb so errors
 * are captured as typed Err values instead of thrown exceptions.
 */

import { fromPromise, type ResultAsync } from "neverthrow";
import { Prisma } from "@prisma/client";

function mapDbError(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return "A record with that value already exists.";
    if (e.code === "P2025") return "Record not found.";
    if (e.code === "P2003") return "A related record could not be found.";
    if (e.code === "P2014") return "The operation violates a required relation.";
  }
  if (e instanceof Prisma.PrismaClientValidationError) {
    return "Invalid data provided to the database.";
  }
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return "Database connection failed. Please try again.";
  }
  return "An unexpected database error occurred. Please try again.";
}

export function safeDb<T>(promise: Promise<T>): ResultAsync<T, string> {
  return fromPromise(promise, mapDbError);
}
