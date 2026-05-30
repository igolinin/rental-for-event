import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getRevenueReport,
  getInventoryUtilizationReport,
  getLaborReport,
} from "@/server/queries/reports";
import { formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ type?: string; from?: string; to?: string }>;
}

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function pct(n: number) {
  return `${n}%`;
}

const SHARED_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #1e293b; background: white; padding: 48px; }
  h1 { font-size: 22px; font-weight: 700; color: #0f172a; }
  h2 { font-size: 13px; font-weight: 600; color: #64748b; margin-top: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #0f172a; }
  .company-name { font-size: 16px; font-weight: 700; }
  .company-meta { font-size: 11px; color: #64748b; margin-top: 2px; }
  .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
  .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; }
  .kpi-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
  .kpi-value { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding: 8px 0; text-align: left; }
  td { padding: 9px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .bar-track { background: #e2e8f0; border-radius: 2px; height: 6px; }
  .bar-fill { background: #3b82f6; border-radius: 2px; height: 6px; }
  .print-btn { position: fixed; top: 16px; right: 16px; background: #0f172a; color: white; border: none; padding: 8px 18px; border-radius: 6px; font-size: 13px; cursor: pointer; }
  @media print {
    body { padding: 24px; }
    @page { margin: 0; size: A4; }
    .print-btn { display: none; }
  }
`;

export default async function ReportPrintPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const type = params.type ?? "revenue";
  const now = new Date();
  const from = params.from ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = params.to ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  if (!["revenue", "utilization", "labor"].includes(type)) notFound();

  const [settings, revenueData, utilizationData, laborData] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { id: "singleton" } }),
    type === "revenue" ? getRevenueReport({ fromDate: from, toDate: to }) : null,
    type === "utilization" ? getInventoryUtilizationReport({ fromDate: from, toDate: to }) : null,
    type === "labor" ? getLaborReport({ fromDate: from, toDate: to }) : null,
  ]);

  const companyName = settings?.companyName ?? "Event Rental Manager";
  const period = `${formatDate(new Date(from))} – ${formatDate(new Date(to))}`;

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>
          {type === "revenue" ? "Revenue" : type === "utilization" ? "Utilization" : "Labor"} Report — {period}
        </title>
        <style>{SHARED_CSS}</style>
      </head>
      <body>
        <button className="print-btn" id="print-btn">Print / Save PDF</button>

        <div className="header">
          <div>
            <h1>
              {type === "revenue" ? "Revenue Report" : type === "utilization" ? "Inventory Utilization Report" : "Labor Summary Report"}
            </h1>
            <h2>{period}</h2>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="company-name">{companyName}</div>
            <div className="company-meta">Generated {formatDate(new Date())}</div>
          </div>
        </div>

        {/* ── REVENUE ── */}
        {revenueData && (
          <>
            <div className="kpi-row">
              <div className="kpi">
                <div className="kpi-label">Total Revenue</div>
                <div className="kpi-value">{formatCents(revenueData.totalRevenue)}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Collected</div>
                <div className="kpi-value">{formatCents(revenueData.totalPaid)}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Outstanding</div>
                <div className="kpi-value">{formatCents(revenueData.totalBalance)}</div>
              </div>
            </div>

            <table style={{ marginBottom: 28 }}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="num">Total</th>
                  <th className="num">Collected</th>
                  <th className="num">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {revenueData.byClient.map((row) => (
                  <tr key={row.clientName}>
                    <td>{row.clientName}</td>
                    <td className="num">{formatCents(row.total)}</td>
                    <td className="num">{formatCents(row.paid)}</td>
                    <td className="num">{formatCents(row.total - row.paid)}</td>
                  </tr>
                ))}
                {revenueData.byClient.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ color: "#94a3b8", textAlign: "center", padding: 24 }}>
                      No invoices in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Project</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                  <th className="num">Paid</th>
                </tr>
              </thead>
              <tbody>
                {revenueData.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontFamily: "monospace" }}>{inv.refCode}</td>
                    <td>{inv.project.name}</td>
                    <td>{inv.client.name}</td>
                    <td>{formatDate(inv.issueDate)}</td>
                    <td>{inv.status}</td>
                    <td className="num">{formatCents(inv.totalAmount, inv.currencyCode)}</td>
                    <td className="num">{formatCents(inv.paidAmount, inv.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ── UTILIZATION ── */}
        {utilizationData && (
          <>
            <div className="kpi-row">
              <div className="kpi">
                <div className="kpi-label">Items Tracked</div>
                <div className="kpi-value">{utilizationData.length}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Avg Utilization</div>
                <div className="kpi-value">
                  {utilizationData.length > 0
                    ? pct(Math.round(utilizationData.reduce((s, r) => s + r.utilizationPct, 0) / utilizationData.length))
                    : "—"}
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Period</div>
                <div className="kpi-value" style={{ fontSize: 14, marginTop: 6 }}>{period}</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="num">Qty</th>
                  <th className="num">Booked days</th>
                  <th style={{ width: 120 }}>Utilization</th>
                  <th className="num">%</th>
                </tr>
              </thead>
              <tbody>
                {utilizationData.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td style={{ color: "#64748b" }}>{row.categoryName}</td>
                    <td className="num">{row.totalQuantity}</td>
                    <td className="num">{row.bookedDays}</td>
                    <td style={{ padding: "9px 8px" }}>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: pct(row.utilizationPct) }} />
                      </div>
                    </td>
                    <td className="num">{pct(row.utilizationPct)}</td>
                  </tr>
                ))}
                {utilizationData.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ color: "#94a3b8", textAlign: "center", padding: 24 }}>
                      No inventory data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* ── LABOR ── */}
        {laborData && (
          <>
            <div className="kpi-row">
              <div className="kpi">
                <div className="kpi-label">Total Labor Cost</div>
                <div className="kpi-value">{formatCents(laborData.totalLabor)}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Regular Hours</div>
                <div className="kpi-value">{laborData.totalRegularHours.toFixed(1)}h</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">OT / DT Hours</div>
                <div className="kpi-value">{laborData.totalOvertimeHours.toFixed(1)}h</div>
              </div>
            </div>

            <table style={{ marginBottom: 28 }}>
              <thead>
                <tr>
                  <th>Crew Member</th>
                  <th>Type</th>
                  <th className="num">Regular Hrs</th>
                  <th className="num">OT / DT Hrs</th>
                  <th className="num">Entries</th>
                  <th className="num">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {laborData.byCrew.map((row) => (
                  <tr key={row.crewMemberId}>
                    <td>{row.name}</td>
                    <td style={{ color: "#64748b" }}>{row.type}</td>
                    <td className="num">{row.regularHours.toFixed(1)}</td>
                    <td className="num">{row.overtimeHours.toFixed(1)}</td>
                    <td className="num">{row.entries}</td>
                    <td className="num">{formatCents(row.totalAmount)}</td>
                  </tr>
                ))}
                {laborData.byCrew.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ color: "#94a3b8", textAlign: "center", padding: 24 }}>
                      No approved timesheets in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <table>
              <thead>
                <tr>
                  <th>Crew</th>
                  <th>Project</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="num">Regular</th>
                  <th className="num">OT</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {laborData.timesheets.map((ts) => (
                  <tr key={ts.id}>
                    <td>{ts.crewMember.firstName} {ts.crewMember.lastName}</td>
                    <td>{ts.project.name}</td>
                    <td>{formatDate(ts.clockIn)}</td>
                    <td>{ts.timeType}</td>
                    <td className="num">{Number(ts.regularHours ?? 0).toFixed(1)}h</td>
                    <td className="num">{(Number(ts.overtimeHours ?? 0) + Number(ts.doubleTimeHours ?? 0)).toFixed(1)}h</td>
                    <td className="num">{formatCents(ts.totalAmount ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <script dangerouslySetInnerHTML={{ __html: "document.getElementById('print-btn').onclick=function(){window.print()}" }} />
      </body>
    </html>
  );
}
