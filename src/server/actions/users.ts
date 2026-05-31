"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { safeDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

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

// ─── Permission management ────────────────────────────────────────────────────

const grantPermissionSchema = z.object({
  resource: z.enum(["INVENTORY","INVENTORY_PRICING","WAREHOUSES","PROJECTS","CREW","TIMESHEETS","INVOICES","CLIENTS","REPORTS","SETTINGS","AUDIT"]),
  action: z.enum(["READ","CREATE","UPDATE","DELETE","APPROVE","MANAGE"]),
  resourceId: z.string().optional().nullable(),
  granted: z.boolean().default(true),
});

export async function grantPermission(targetUserId: string, data: unknown) {
  const check = await requireAdmin();
  if ("error" in check) return check;

  const parsed = grantPermissionSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { resource, action, resourceId, granted } = parsed.data;

  // Find existing permission for this exact combination
  const existing = await prisma.userPermission.findFirst({
    where: { userId: targetUserId, resource, action, resourceId: resourceId || null },
  });
  const result = existing
    ? await safeDb(prisma.userPermission.update({ where: { id: existing.id }, data: { granted, grantedById: check.session.user.id } }))
    : await safeDb(prisma.userPermission.create({ data: { userId: targetUserId, resource, action, resourceId: resourceId || null, granted, grantedById: check.session.user.id } }));
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "User", entityId: targetUserId, action: "PERMISSION_CHANGE", userId: check.session.user.id, meta: { resource, action, resourceId, granted } });
  revalidatePath("/dashboard/users");
  return { success: true, id: result.value.id };
}

export async function revokePermission(permissionId: string) {
  const check = await requireAdmin();
  if ("error" in check) return check;

  const result = await safeDb(prisma.userPermission.delete({ where: { id: permissionId } }));
  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function getUserPermissions(userId: string) {
  const check = await requireAdmin();
  if ("error" in check) return { permissions: [] };
  return {
    permissions: await prisma.userPermission.findMany({
      where: { userId },
      include: { grantedBy: { select: { name: true } } },
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    }),
  };
}
