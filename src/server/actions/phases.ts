"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { projectPhaseSchema } from "@/schemas/phases";

export async function createProjectPhase(projectId: string, data: unknown) {
  const session = await auth();
  const denied = await requirePermission(session, "PROJECTS", "UPDATE");
  if (denied) return denied;

  const parsed = projectPhaseSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const maxSort = await safeDb(
    prisma.projectPhase.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    })
  );
  const sortOrder = maxSort.isOk()
    ? (maxSort.value._max.sortOrder ?? -1) + 1
    : d.sortOrder;

  const result = await safeDb(
    prisma.projectPhase.create({
      data: {
        projectId,
        name: d.name,
        customLabel: d.customLabel || null,
        startAt: new Date(d.startAt),
        endAt: new Date(d.endAt),
        sortOrder,
        notes: d.notes,
      },
    })
  );

  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true, id: result.value.id };
}

export async function deleteProjectPhase(phaseId: string, projectId: string) {
  const result = await safeDb(
    prisma.projectPhase.delete({ where: { id: phaseId } })
  );
  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}
