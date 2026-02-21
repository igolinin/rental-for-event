import { Metadata } from "next";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Welcome back, {session?.user?.name}
        </p>
      </div>

      {/* KPI placeholder grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Projects", value: "—", color: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "Open Invoices", value: "—", color: "bg-amber-50 text-amber-700 border-amber-200" },
          { label: "Maintenance Alerts", value: "—", color: "bg-red-50 text-red-700 border-red-200" },
          { label: "Crew Booked Today", value: "—", color: "bg-green-50 text-green-700 border-green-200" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={`rounded-xl border p-5 ${kpi.color}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide opacity-70">
              {kpi.label}
            </p>
            <p className="mt-2 text-3xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm text-slate-400">
        Phase 1 scaffold complete — data will populate as modules are built.
      </p>
    </div>
  );
}
