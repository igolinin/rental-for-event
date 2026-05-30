"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { safeDb } from "@/lib/db";
import { auth } from "@/lib/auth";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "VIEWER"]).default("STAFF"),
});

const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "VIEWER"]),
  isActive: z.boolean(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated." };
  if (session.user.role !== "ADMIN") return { error: "Admin access required." };
  return { session };
}

export async function createUser(data: unknown) {
  const check = await requireAdmin();
  if ("error" in check) return check;

  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { name, email, password, role } = parsed.data;

  const existingResult = await safeDb(prisma.user.findUnique({ where: { email } }));
  if (existingResult.isErr()) return { error: existingResult.error };
  if (existingResult.value) return { error: "A user with that email already exists." };

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await safeDb(prisma.user.create({ data: { name, email, passwordHash, role } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/users");
  return { success: true, id: result.value.id };
}

export async function updateUser(id: string, data: unknown) {
  const check = await requireAdmin();
  if ("error" in check) return check;

  const parsed = updateUserSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { name, role, isActive } = parsed.data;
  const result = await safeDb(prisma.user.update({ where: { id }, data: { name, role, isActive } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function resetUserPassword(id: string, newPassword: string) {
  const check = await requireAdmin();
  if ("error" in check) return check;

  if (newPassword.length < 8) return { error: "Password must be at least 8 characters." };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const result = await safeDb(prisma.user.update({ where: { id }, data: { passwordHash } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/users");
  return { success: true };
}
