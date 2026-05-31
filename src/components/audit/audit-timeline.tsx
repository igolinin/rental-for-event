import { formatDate } from "@/lib/utils";
import type { EntityHistoryEntry } from "@/server/queries/audit";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE:           { label: "Created",          color: "bg-green-100 text-green-700" },
  UPDATE:           { label: "Updated",          color: "bg-blue-100 text-blue-700" },
  DELETE:           { label: "Deleted",          color: "bg-red-100 text-red-700" },
  STATUS_CHANGE:    { label: "Status changed",   color: "bg-amber-100 text-amber-700" },
  ALLOCATION:       { label: "Equipment booked", color: "bg-indigo-100 text-indigo-700" },
  APPROVAL:         { label: "Approved",         color: "bg-green-100 text-green-700" },
  REJECTION:        { label: "Rejected",         color: "bg-red-100 text-red-700" },
  PERMISSION_CHANGE:{ label: "Permission change",color: "bg-purple-100 text-purple-700" },
};

function ChangeSummary({ changes }: { changes: unknown }) {
  if (!changes || typeof changes !== "object") return null;
  const entries = Object.entries(changes as Record<string, { from: unknown; to: unknown }>);
  if (entries.length === 0) return null;

  return (
    <ul className="mt-1.5 space-y-0.5">
      {entries.map(([field, { from, to }]) => (
        <li key={field} className="text-xs text-muted-foreground">
          <span className="font-medium">{field}</span>
          {": "}
          <span className="line-through text-red-500">{renderValue(from)}</span>
          {" → "}
          <span className="text-green-700">{renderValue(to)}</span>
        </li>
      ))}
    </ul>
  );
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  return String(v);
}

interface AuditTimelineProps {
  entries: EntityHistoryEntry[];
  emptyText?: string;
}

export function AuditTimeline({ entries, emptyText = "No history recorded yet." }: AuditTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">{emptyText}</p>
    );
  }

  return (
    <ol className="relative border-l border-slate-200 ml-3 space-y-4 py-2">
      {entries.map((entry) => {
        const actionMeta = ACTION_LABELS[entry.action] ?? { label: entry.action, color: "bg-slate-100 text-slate-600" };
        return (
          <li key={entry.id} className="ml-4">
            {/* Dot */}
            <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-300" />

            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${actionMeta.color}`}>
                {actionMeta.label}
              </span>
              {entry.user && (
                <span className="text-xs font-medium text-slate-700">{entry.user.name}</span>
              )}
              <time className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</time>
            </div>

            {entry.entityLabel && (
              <p className="text-xs text-muted-foreground mt-0.5">{entry.entityLabel}</p>
            )}

            <ChangeSummary changes={entry.changes} />

            {entry.meta && typeof entry.meta === "object" && (
              <details className="mt-1">
                <summary className="text-xs text-muted-foreground cursor-pointer">Details</summary>
                <pre className="text-[10px] text-muted-foreground bg-slate-50 rounded p-2 mt-1 overflow-x-auto">
                  {JSON.stringify(entry.meta, null, 2)}
                </pre>
              </details>
            )}
          </li>
        );
      })}
    </ol>
  );
}
