"use client";

import { signOut } from "next-auth/react";
import type { UserRole } from "@prisma/client";

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: UserRole;
  };
}

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  STAFF: "Staff",
  VIEWER: "Viewer",
};

export function Header({ user }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-6 gap-4 flex-shrink-0">
      <div className="text-right">
        <p className="text-sm font-medium text-slate-900">{user.name}</p>
        <p className="text-xs text-slate-500">
          {user.role ? roleLabels[user.role] : ""}
        </p>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-sm text-slate-500 hover:text-slate-900 transition-colors px-3 py-1.5 rounded-md hover:bg-slate-100"
      >
        Sign out
      </button>
    </header>
  );
}
