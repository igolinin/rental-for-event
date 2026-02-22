import { notFound } from "next/navigation";
import { getInvoiceById } from "@/server/queries/invoices";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function PrintInvoicePage({ params }: PageProps) {
  const { id } = await params;
  const [invoice, settings] = await Promise.all([
    getInvoiceById(id),
    prisma.systemSettings.findUnique({ where: { id: "singleton" } }),
  ]);
  if (!invoice) notFound();

  const balance = invoice.totalAmount - invoice.paidAmount;
  const cc = invoice.currencyCode;

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Invoice {invoice.refCode}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #1e293b; background: white; padding: 48px; }
          h1 { font-size: 28px; font-weight: 700; color: #0f172a; }
          h2 { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #0f172a; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
          .company { max-width: 240px; }
          .company-name { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
          .company-meta { font-size: 12px; color: #64748b; line-height: 1.6; }
          .invoice-meta { text-align: right; }
          .invoice-meta .ref { font-size: 22px; font-weight: 700; color: #0f172a; }
          .invoice-meta table { margin-left: auto; margin-top: 8px; font-size: 12px; }
          .invoice-meta td { padding: 2px 0 2px 16px; }
          .invoice-meta td:first-child { color: #64748b; text-align: right; }
          .invoice-meta td:last-child { font-weight: 500; }
          .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
          .party-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 4px; }
          .party-name { font-weight: 600; font-size: 14px; }
          table.lines { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          table.lines th { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding: 8px 0; }
          table.lines th:last-child, table.lines td:last-child { text-align: right; }
          table.lines td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
          .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
          .totals table { font-size: 13px; min-width: 220px; }
          .totals td { padding: 4px 0; }
          .totals td:first-child { color: #64748b; padding-right: 32px; }
          .totals td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
          .totals tr.total td { font-weight: 700; font-size: 15px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
          .totals tr.balance td { font-weight: 700; }
          .balance-due { color: #dc2626; }
          .balance-paid { color: #16a34a; }
          .footer { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569; }
          .footer-label { font-weight: 600; color: #0f172a; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
          @media print {
            body { padding: 24px; }
            @page { margin: 0; }
          }
        `}</style>
      </head>
      <body>
        <div className="header">
          <div className="company">
            <div className="company-name">{settings?.companyName ?? "Company"}</div>
            <div className="company-meta">
              {settings?.companyAddress && <div>{settings.companyAddress}</div>}
              {settings?.companyEmail && <div>{settings.companyEmail}</div>}
              {settings?.companyPhone && <div>{settings.companyPhone}</div>}
            </div>
          </div>
          <div className="invoice-meta">
            <div className="ref">INVOICE</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{invoice.refCode}</div>
            <table>
              <tbody>
                <tr>
                  <td>Status</td>
                  <td>{invoice.status}</td>
                </tr>
                <tr>
                  <td>Type</td>
                  <td>{invoice.type}</td>
                </tr>
                <tr>
                  <td>Issue date</td>
                  <td>{formatDate(invoice.issueDate)}</td>
                </tr>
                <tr>
                  <td>Due date</td>
                  <td>{formatDate(invoice.dueDate)}</td>
                </tr>
                <tr>
                  <td>Currency</td>
                  <td>{cc}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="parties">
          <div>
            <div className="party-label">Bill to</div>
            <div className="party-name">{invoice.client.name}</div>
            {invoice.client.address && (
              <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                {invoice.client.address}
              </div>
            )}
          </div>
          <div>
            <div className="party-label">Project</div>
            <div className="party-name">{invoice.project.name}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {invoice.project.refCode}
            </div>
          </div>
        </div>

        <table className="lines">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Description</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th style={{ textAlign: "right" }}>Unit price</th>
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((li) => (
              <tr key={li.id}>
                <td>{li.description}</td>
                <td style={{ textAlign: "right" }}>{Number(li.quantity).toFixed(2)}</td>
                <td style={{ textAlign: "right" }}>{formatCents(li.unitAmount, cc)}</td>
                <td style={{ textAlign: "right" }}>{formatCents(li.totalAmount, cc)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals">
          <table>
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td>{formatCents(invoice.subtotalAmount, cc)}</td>
              </tr>
              {invoice.taxAmount > 0 && (
                <tr>
                  <td>Tax</td>
                  <td>{formatCents(invoice.taxAmount, cc)}</td>
                </tr>
              )}
              {invoice.discountAmount > 0 && (
                <tr>
                  <td>Discount</td>
                  <td>−{formatCents(invoice.discountAmount, cc)}</td>
                </tr>
              )}
              <tr className="total">
                <td>Total</td>
                <td>{formatCents(invoice.totalAmount, cc)}</td>
              </tr>
              <tr>
                <td>Paid</td>
                <td className="balance-paid">{formatCents(invoice.paidAmount, cc)}</td>
              </tr>
              <tr className="balance">
                <td>Balance due</td>
                <td className={balance > 0 ? "balance-due" : "balance-paid"}>
                  {formatCents(balance, cc)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {(invoice.notes || invoice.terms) && (
          <div className="footer">
            {invoice.notes && (
              <div>
                <div className="footer-label">Notes</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{invoice.notes}</div>
              </div>
            )}
            {invoice.terms && (
              <div>
                <div className="footer-label">Payment terms</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{invoice.terms}</div>
              </div>
            )}
          </div>
        )}

        <script
          dangerouslySetInnerHTML={{
            __html: "window.onload = () => window.print();",
          }}
        />
      </body>
    </html>
  );
}
