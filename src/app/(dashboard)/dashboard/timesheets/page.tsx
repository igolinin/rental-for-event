import { Metadata } from "next";
import { getTimesheets } from "@/server/queries/crew";
import { TimesheetsClient } from "@/components/crew/timesheets-client";

export const metadata: Metadata = { title: "Timesheets" };

interface PageProps {
  searchParams: Promise<{ status?: string; crewMemberId?: string }>;
}

const VALID_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as const;
type TimesheetStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(s?: string): s is TimesheetStatus {
  return VALID_STATUSES.includes(s as TimesheetStatus);
}

export default async function TimesheetsPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const timesheets = await getTimesheets({
    status: isValidStatus(status) ? status : undefined,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Timesheets</h1>
          <p className="text-sm text-slate-500 mt-0.5">{timesheets.length} entries</p>
        </div>
      </div>

      <form method="GET" className="flex flex-wrap gap-3 mb-4">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-3 h-9 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          Filter
        </button>
        {status && (
          <a
            href="/dashboard/timesheets"
            className="inline-flex items-center justify-center rounded-md px-3 h-9 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            Clear
          </a>
        )}
      </form>

      <TimesheetsClient timesheets={timesheets} />
    </div>
  );
}
