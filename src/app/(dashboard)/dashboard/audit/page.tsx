import { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { getAuditLogs, getAuditLogEntityTypes } from "@/server/queries/audit";
import { getUsers } from "@/server/queries/users";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit Log" };

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  CREATE:           { label: "Created",           className: "bg-green-50 text-green-700 border-green-200" },
  UPDATE:           { label: "Updated",           className: "bg-blue-50 text-blue-700 border-blue-200" },
  DELETE:           { label: "Deleted",           className: "bg-red-50 text-red-700 border-red-200" },
  STATUS_CHANGE:    { label: "Status change",     className: "bg-amber-50 text-amber-700 border-amber-200" },
  ALLOCATION:       { label: "Equipment booking", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  APPROVAL:         { label: "Approved",          className: "bg-green-50 text-green-700 border-green-200" },
  REJECTION:        { label: "Rejected",          className: "bg-red-50 text-red-700 border-red-200" },
  PERMISSION_CHANGE:{ label: "Permission change", className: "bg-purple-50 text-purple-700 border-purple-200" },
};

interface PageProps {
  searchParams: Promise<{
    entityType?: string;
    userId?: string;
    action?: string;
    from?: string;
    to?: string;
    cursor?: string;
  }>;
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  const [logs, entityTypes, users] = await Promise.all([
    getAuditLogs({
      entityType: params.entityType,
      userId: params.userId,
      action: params.action,
      fromDate: params.from,
      toDate: params.to,
      cursor: params.cursor,
      take: 50,
    }),
    getAuditLogEntityTypes(),
    getUsers(),
  ]);

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">All system events — who changed what and when</p>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6">
        <select
          name="entityType"
          defaultValue={params.entityType ?? ""}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All entity types</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          name="userId"
          defaultValue={params.userId ?? ""}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <select
          name="action"
          defaultValue={params.action ?? ""}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <input type="date" name="from" defaultValue={params.from ?? defaultFrom}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
        <input type="date" name="to" defaultValue={params.to ?? defaultTo}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />

        <button type="submit"
          className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-3 h-9 text-sm shadow-sm hover:bg-accent">
          Filter
        </button>
        {(params.entityType || params.userId || params.action) && (
          <Link href="/dashboard/audit" className="inline-flex items-center h-9 px-3 text-sm text-muted-foreground hover:underline">
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="rounded-md border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Who</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Entity</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  No audit events found for the selected filters.
                </td>
              </tr>
            )}
            {logs.map((log) => {
              const actionMeta = ACTION_LABELS[log.action] ?? { label: log.action, className: "bg-slate-100 text-slate-600 border-slate-200" };
              const changes = log.changes && typeof log.changes === "object"
                ? Object.entries(log.changes as Record<string, { from: unknown; to: unknown }>)
                : [];

              return (
                <tr key={log.id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {log.user ? (
                      <div>
                        <p className="font-medium text-slate-900">{log.user.name}</p>
                        <p className="text-muted-foreground">{log.user.role}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-[10px] ${actionMeta.className}`}>
                      {actionMeta.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-medium">{log.entityType}</p>
                    {log.entityLabel && <p className="text-muted-foreground">{log.entityLabel}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {changes.length > 0 && (
                      <ul className="space-y-0.5">
                        {changes.slice(0, 3).map(([field, { from, to }]) => (
                          <li key={field} className="text-xs">
                            <span className="font-medium text-slate-700">{field}: </span>
                            <span className="text-red-500 line-through">{String(from ?? "—")}</span>
                            {" → "}
                            <span className="text-green-700">{String(to ?? "—")}</span>
                          </li>
                        ))}
                        {changes.length > 3 && (
                          <li className="text-xs text-muted-foreground">+{changes.length - 3} more fields</li>
                        )}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {logs.length === 50 && (
        <div className="mt-4 flex justify-center">
          <Link
            href={`/dashboard/audit?${new URLSearchParams({ ...params, cursor: logs[logs.length - 1].id }).toString()}`}
            className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-4 h-9 text-sm shadow-sm hover:bg-accent"
          >
            Load older events →
          </Link>
        </div>
      )}
    </div>
  );
}
