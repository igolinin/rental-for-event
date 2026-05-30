import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUsers } from "@/server/queries/users";
import { UsersClient } from "@/components/users/users-client";

export const metadata: Metadata = { title: "Team" };

export default async function UsersPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const users = await getUsers();
  return <UsersClient users={users} />;
}
