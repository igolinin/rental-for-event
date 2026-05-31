"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safeDb } from "@/lib/db";
import { generateRefCode } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { invoiceSchema, invoiceUpdateSchema, paymentSchema } from "@/schemas/invoices";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeLineTotal(quantity: number, unitAmount: number): number {
  return Math.round(quantity * unitAmount);
}

function computeTotals(
  lineItems: { quantity: number; unitAmount: number; taxRate?: number | null }[],
  invoiceTaxRate: number | null | undefined,
  discountAmount: number
) {
  const subtotal = lineItems.reduce(
    (sum, li) => sum + computeLineTotal(li.quantity, li.unitAmount),
    0
  );
  const taxAmount = lineItems.reduce((sum, li) => {
    const rate = li.taxRate ?? invoiceTaxRate ?? 0;
    return sum + Math.round(computeLineTotal(li.quantity, li.unitAmount) * rate);
  }, 0);
  const total = Math.max(0, subtotal + taxAmount - discountAmount);
  return { subtotal, taxAmount, total };
}

// ─── Invoice CRUD ─────────────────────────────────────────────────────────────

export async function createInvoice(data: unknown) {
  const session = await auth();
  const denied = await requirePermission(session, "INVOICES", "CREATE");
  if (denied) return denied;

  const parsed = invoiceSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const { subtotal, taxAmount, total } = computeTotals(d.lineItems, d.taxRate, d.discountAmount);
  const refCode = generateRefCode("INV");

  const result = await safeDb(
    prisma.invoice.create({
      data: {
        refCode,
        projectId: d.projectId,
        clientId: d.clientId,
        type: d.type,
        issueDate: new Date(d.issueDate),
        dueDate: new Date(d.dueDate),
        currencyCode: d.currencyCode,
        subtotalAmount: subtotal,
        taxAmount,
        discountAmount: d.discountAmount,
        totalAmount: total,
        notes: d.notes || null,
        terms: d.terms || null,
        createdById: session!.user!.id,
        lineItems: {
          create: d.lineItems.map((li, idx) => ({
            description: li.description,
            quantity: li.quantity,
            unitAmount: li.unitAmount,
            totalAmount: computeLineTotal(li.quantity, li.unitAmount),
            taxRate: li.taxRate ?? null,
            sortOrder: li.sortOrder ?? idx,
          })),
        },
      },
    })
  );

  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "Invoice", entityId: result.value.id, entityLabel: result.value.refCode, action: "CREATE", userId: session?.user?.id, meta: { projectId: d.projectId } });
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/projects/${d.projectId}`);
  return { success: true, id: result.value.id };
}

export async function updateInvoice(id: string, data: unknown) {
  const session = await auth();
  const denied = await requirePermission(session, "INVOICES", "UPDATE");
  if (denied) return denied;

  const parsed = invoiceUpdateSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const { subtotal, taxAmount, total } = computeTotals(d.lineItems, d.taxRate, d.discountAmount);

  const result = await safeDb(
    prisma.$transaction([
      prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } }),
      prisma.invoice.update({
        where: { id },
        data: {
          type: d.type,
          issueDate: new Date(d.issueDate),
          dueDate: new Date(d.dueDate),
          currencyCode: d.currencyCode,
          subtotalAmount: subtotal,
          taxAmount,
          discountAmount: d.discountAmount,
          totalAmount: total,
          notes: d.notes || null,
          terms: d.terms || null,
          lineItems: {
            create: d.lineItems.map((li, idx) => ({
              description: li.description,
              quantity: li.quantity,
              unitAmount: li.unitAmount,
              totalAmount: computeLineTotal(li.quantity, li.unitAmount),
              taxRate: li.taxRate ?? null,
              sortOrder: li.sortOrder ?? idx,
            })),
          },
        },
      }),
    ])
  );

  if (result.isErr()) return { error: result.error };
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${id}`);
  return { success: true };
}

export async function updateInvoiceStatus(
  id: string,
  status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID"
) {
  const session = await auth();
  const denied = await requirePermission(session, "INVOICES", "UPDATE");
  if (denied) return denied;
  const invoiceResult = await safeDb(
    prisma.invoice.findUnique({ where: { id }, select: { projectId: true } })
  );
  if (invoiceResult.isErr()) return { error: invoiceResult.error };
  if (!invoiceResult.value) return { error: "Invoice not found." };

  const result = await safeDb(
    prisma.invoice.update({ where: { id }, data: { status } })
  );
  if (result.isErr()) return { error: result.error };
  await logAudit({ entityType: "Invoice", entityId: id, action: "STATUS_CHANGE", userId: session?.user?.id, changes: { status: { from: null, to: status } } });
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${id}`);
  revalidatePath(`/dashboard/projects/${invoiceResult.value.projectId}`);
  return { success: true };
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function addPayment(invoiceId: string, data: unknown) {
  const parsed = paymentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const invoiceResult = await safeDb(
    prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { select: { amount: true } } },
    })
  );
  if (invoiceResult.isErr()) return { error: invoiceResult.error };
  if (!invoiceResult.value) return { error: "Invoice not found." };

  const invoice = invoiceResult.value;
  const newPaidAmount = invoice.paidAmount + d.amount;

  const result = await safeDb(
    prisma.$transaction([
      prisma.invoicePayment.create({
        data: {
          invoiceId,
          amount: d.amount,
          currency: d.currency,
          method: d.method,
          receivedAt: new Date(d.receivedAt),
          reference: d.reference || null,
          notes: d.notes || null,
        },
      }),
      prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          status:
            newPaidAmount >= invoice.totalAmount
              ? "PAID"
              : newPaidAmount > 0
              ? "PARTIALLY_PAID"
              : invoice.status,
        },
      }),
    ])
  );

  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/invoices");
  return { success: true };
}

export async function deletePayment(paymentId: string, invoiceId: string) {
  const paymentResult = await safeDb(
    prisma.invoicePayment.findUnique({ where: { id: paymentId }, select: { amount: true } })
  );
  if (paymentResult.isErr()) return { error: paymentResult.error };
  if (!paymentResult.value) return { error: "Payment not found." };

  const invoiceResult = await safeDb(
    prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { paidAmount: true, totalAmount: true },
    })
  );
  if (invoiceResult.isErr()) return { error: invoiceResult.error };
  if (!invoiceResult.value) return { error: "Invoice not found." };

  const newPaidAmount = Math.max(0, invoiceResult.value.paidAmount - paymentResult.value.amount);

  const result = await safeDb(
    prisma.$transaction([
      prisma.invoicePayment.delete({ where: { id: paymentId } }),
      prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          status:
            newPaidAmount >= invoiceResult.value.totalAmount
              ? "PAID"
              : newPaidAmount > 0
              ? "PARTIALLY_PAID"
              : "SENT",
        },
      }),
    ])
  );

  if (result.isErr()) return { error: result.error };
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/invoices");
  return { success: true };
}
