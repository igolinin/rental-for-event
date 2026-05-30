import { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getDashboardKpis } from "@/server/queries/reports";

export const metadata: Metadata = { title: "Dashboard" };

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    notation: "compact",
  }).format(cents / 100);
}

export default async function DashboardPage() {
  const [session, kpis] = await Promise.all([auth(), getDashboardKpis()]);

  const kpiCards = [
    {
      label: "Active Projects",
      value: kpis.activeProjectsCount,
      href: "/dashboard/projects",
      color: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      label: "Open Invoices",
      value: kpis.openInvoicesCount,
      sub: `${formatCents(kpis.openBalance)} outstanding`,
      href: "/dashboard/invoices?status=SENT",
      color: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      label: "Maintenance Alerts",
      value: kpis.maintenanceAlertsCount,
      href: "/dashboard/maintenance",
      color: kpis.maintenanceAlertsCount > 0
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-slate-50 text-slate-600 border-slate-200",
    },
    {
      label: "Crew Booked Today",
      value: kpis.crewBookedTodayCount,
      href: "/dashboard/crew",
      color: "bg-green-50 text-green-700 border-green-200",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Welcome back, {session?.user?.name}
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {kpiCards.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className={`rounded-xl border p-5 hover:opacity-90 transition-opacity ${kpi.color}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide opacity-70">
              {kpi.label}
            </p>
            <p className="mt-2 text-3xl font-bold">{kpi.value}</p>
            {kpi.sub && (
              <p className="mt-1 text-xs opacity-70">{kpi.sub}</p>
            )}
          </Link>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            This month&apos;s invoiced
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCents(kpis.monthlyRevenue)}
          </p>
        </div>
        <Link
          href="/dashboard/timesheets?status=SUBMITTED"
          className="rounded-xl border bg-white p-5 hover:bg-slate-50 transition-colors"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Timesheets awaiting approval
          </p>
          <p className={`mt-2 text-2xl font-bold ${kpis.submittedTimesheetsCount > 0 ? "text-amber-600" : "text-slate-900"}`}>
            {kpis.submittedTimesheetsCount}
          </p>
        </Link>
        <Link
          href="/dashboard/timesheets?status=DRAFT"
          className="rounded-xl border bg-white p-5 hover:bg-slate-50 transition-colors"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Draft timesheets
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {kpis.draftTimesheetsCount}
          </p>
        </Link>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/invoices/new"
          className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          + New invoice
        </Link>
        <Link
          href="/dashboard/projects/new"
          className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          + New project
        </Link>
        <Link
          href="/dashboard/crew/new"
          className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          + Add crew member
        </Link>
        <Link
          href="/dashboard/reports"
          className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          View reports
        </Link>
      </div>
    </div>
  );
}
