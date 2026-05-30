import { prisma } from "@/lib/prisma";

export async function getUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

export type UserListEntry = Awaited<ReturnType<typeof getUsers>>[number];
