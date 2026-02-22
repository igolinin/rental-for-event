"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateRefCode } from "@/lib/utils";
import { auth } from "@/lib/auth";
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

  // Tax: per-line-item rate overrides invoice rate when set
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
  if (!session?.user) return { error: "Not authenticated." };

  const parsed = invoiceSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const { subtotal, taxAmount, total } = computeTotals(
    d.lineItems,
    d.taxRate,
    d.discountAmount
  );

  const refCode = generateRefCode("INV");

  const invoice = await prisma.invoice.create({
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
      createdById: session.user.id,
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
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/projects/${d.projectId}`);
  return { success: true, id: invoice.id };
}

export async function updateInvoice(id: string, data: unknown) {
  const parsed = invoiceUpdateSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const { subtotal, taxAmount, total } = computeTotals(
    d.lineItems,
    d.taxRate,
    d.discountAmount
  );

  await prisma.$transaction([
    // Replace line items
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
  ]);

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${id}`);
  return { success: true };
}

export async function updateInvoiceStatus(
  id: string,
  status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID"
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!invoice) return { error: "Invoice not found." };

  await prisma.invoice.update({ where: { id }, data: { status } });
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${id}`);
  revalidatePath(`/dashboard/projects/${invoice.projectId}`);
  return { success: true };
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function addPayment(invoiceId: string, data: unknown) {
  const parsed = paymentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: { select: { amount: true } } },
  });
  if (!invoice) return { error: "Invoice not found." };

  const newPaidAmount = invoice.paidAmount + d.amount;

  await prisma.$transaction([
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
  ]);

  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/invoices");
  return { success: true };
}

export async function deletePayment(paymentId: string, invoiceId: string) {
  const payment = await prisma.invoicePayment.findUnique({
    where: { id: paymentId },
    select: { amount: true },
  });
  if (!payment) return { error: "Payment not found." };

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { paidAmount: true, totalAmount: true },
  });
  if (!invoice) return { error: "Invoice not found." };

  const newPaidAmount = Math.max(0, invoice.paidAmount - payment.amount);

  await prisma.$transaction([
    prisma.invoicePayment.delete({ where: { id: paymentId } }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: newPaidAmount,
        status:
          newPaidAmount >= invoice.totalAmount
            ? "PAID"
            : newPaidAmount > 0
            ? "PARTIALLY_PAID"
            : "SENT",
      },
    }),
  ]);

  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/invoices");
  return { success: true };
}
