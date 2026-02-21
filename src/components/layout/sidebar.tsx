"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  FolderKanban,
  Users,
  Clock,
  FileText,
  Wrench,
  TrendingUp,
  Settings,
  Truck,
  Building2,
} from "lucide-react";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Projects",
    href: "/dashboard/projects",
    icon: FolderKanban,
  },
  {
    label: "Inventory",
    href: "/dashboard/inventory",
    icon: Package,
  },
  {
    label: "Maintenance",
    href: "/dashboard/maintenance",
    icon: Wrench,
  },
  {
    label: "Sub-Rentals",
    href: "/dashboard/sub-rentals",
    icon: Truck,
  },
  {
    label: "Clients",
    href: "/dashboard/clients",
    icon: Building2,
  },
  {
    label: "Crew",
    href: "/dashboard/crew",
    icon: Users,
  },
  {
    label: "Timesheets",
    href: "/dashboard/timesheets",
    icon: Clock,
  },
  {
    label: "Invoicing",
    href: "/dashboard/invoices",
    icon: FileText,
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: TrendingUp,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-sidebar flex flex-col flex-shrink-0">
      {/* Logo area */}
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
        <span className="text-sidebar-foreground font-semibold text-sm tracking-wide">
          Event Rental
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
