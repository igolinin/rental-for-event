import { describe, it, expect } from "vitest";
import { projectSchema } from "@/schemas/projects";
import { timesheetSchema, crewRateSchema } from "@/schemas/crew";
import { inventoryItemSchema, inventoryItemSchemaRefined } from "@/schemas/inventory";
import { clientSchema } from "@/schemas/clients";
import { invoiceSchema, paymentSchema } from "@/schemas/invoices";
import { pricingProfileSchema } from "@/schemas/pricing";
import { equipmentItemSchema } from "@/schemas/projects";

const BASE_PROJECT = {
  name: "Test Event",
  type: "SINGLE_EVENT" as const,
  clientId: "client-1",
  startAt: "2026-06-01",
  endAt: "2026-06-05",
  currencyCode: "USD",
};

describe("projectSchema", () => {
  it("valid project passes", () => {
    expect(projectSchema.safeParse(BASE_PROJECT).success).toBe(true);
  });

  it("rejects endAt before startAt", () => {
    const result = projectSchema.safeParse({
      ...BASE_PROJECT,
      startAt: "2026-06-05",
      endAt: "2026-06-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("endAt");
    }
  });

  it("allows endAt === startAt (same-day event)", () => {
    const result = projectSchema.safeParse({
      ...BASE_PROJECT,
      startAt: "2026-06-01",
      endAt: "2026-06-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = projectSchema.safeParse({ ...BASE_PROJECT, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing clientId", () => {
    const result = projectSchema.safeParse({ ...BASE_PROJECT, clientId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid project type", () => {
    const result = projectSchema.safeParse({ ...BASE_PROJECT, type: "UNKNOWN" });
    expect(result.success).toBe(false);
  });

  it("rejects startAt before loadInAt", () => {
    const result = projectSchema.safeParse({
      ...BASE_PROJECT,
      loadInAt: "2026-06-05",
      startAt: "2026-06-01",
      endAt: "2026-06-07",
    });
    expect(result.success).toBe(false);
  });

  it("rejects loadOutAt before endAt", () => {
    const result = projectSchema.safeParse({
      ...BASE_PROJECT,
      startAt: "2026-06-01",
      endAt: "2026-06-07",
      loadOutAt: "2026-06-05",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid loadIn → start → end → loadOut chain", () => {
    const result = projectSchema.safeParse({
      ...BASE_PROJECT,
      loadInAt: "2026-05-31",
      startAt: "2026-06-01",
      endAt: "2026-06-05",
      loadOutAt: "2026-06-06",
    });
    expect(result.success).toBe(true);
  });

  it("taxRate accepts 0", () => {
    expect(projectSchema.safeParse({ ...BASE_PROJECT, taxRate: 0 }).success).toBe(true);
  });

  it("taxRate rejects > 1", () => {
    expect(projectSchema.safeParse({ ...BASE_PROJECT, taxRate: 1.5 }).success).toBe(false);
  });
});

describe("timesheetSchema", () => {
  const BASE_TIMESHEET = {
    crewMemberId: "crew-1",
    clockIn: "2026-06-01T08:00:00",
    clockOut: "2026-06-01T16:00:00",
    breakMinutes: 30,
    timeType: "WORK" as const,
  };

  it("valid timesheet passes", () => {
    expect(timesheetSchema.safeParse(BASE_TIMESHEET).success).toBe(true);
  });

  it("rejects missing crewMemberId", () => {
    const result = timesheetSchema.safeParse({ ...BASE_TIMESHEET, crewMemberId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects negative breakMinutes", () => {
    const result = timesheetSchema.safeParse({ ...BASE_TIMESHEET, breakMinutes: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid timeType", () => {
    const result = timesheetSchema.safeParse({ ...BASE_TIMESHEET, timeType: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("rejects clockOut <= clockIn (FR-11.7)", () => {
    const result = timesheetSchema.safeParse({
      ...BASE_TIMESHEET,
      clockIn: "2026-06-01T10:00:00",
      clockOut: "2026-06-01T08:00:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("clockOut"))).toBe(true);
    }
  });

  it("rejects break longer than shift", () => {
    // 1h shift with 90 min break
    const result = timesheetSchema.safeParse({
      ...BASE_TIMESHEET,
      clockIn: "2026-06-01T08:00:00",
      clockOut: "2026-06-01T09:00:00",
      breakMinutes: 90,
    });
    expect(result.success).toBe(false);
  });
});

describe("crewRateSchema", () => {
  const BASE_RATE = {
    rateType: "REGULAR" as const,
    amount: 5000,
    currency: "USD",
    effectiveFrom: "2026-01-01",
  };

  it("valid rate passes", () => {
    expect(crewRateSchema.safeParse(BASE_RATE).success).toBe(true);
  });

  it("rejects amount of 0 (rates must be > 0)", () => {
    expect(crewRateSchema.safeParse({ ...BASE_RATE, amount: 0 }).success).toBe(false);
  });

  it("accepts positive amount", () => {
    expect(crewRateSchema.safeParse({ ...BASE_RATE, amount: 5000 }).success).toBe(true);
  });

  it("rejects invalid rateType", () => {
    const result = crewRateSchema.safeParse({ ...BASE_RATE, rateType: "UNKNOWN" });
    expect(result.success).toBe(false);
  });

  it("rejects missing effectiveFrom", () => {
    const result = crewRateSchema.safeParse({ ...BASE_RATE, effectiveFrom: "" });
    expect(result.success).toBe(false);
  });
});

describe("inventoryItemSchema", () => {
  const BASE_ITEM = {
    name: "Moving Head",
    categoryId: "cat-1",
    trackingMode: "SERIALIZED" as const,
    totalQuantity: 0,
    dailyRateAmount: 5000,
    dailyRateCurrency: "USD",
  };

  it("valid SERIALIZED item passes", () => {
    expect(inventoryItemSchema.safeParse(BASE_ITEM).success).toBe(true);
  });

  it("valid BULK item passes", () => {
    const bulk = { ...BASE_ITEM, trackingMode: "BULK" as const, totalQuantity: 100 };
    expect(inventoryItemSchema.safeParse(bulk).success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = inventoryItemSchema.safeParse({ ...BASE_ITEM, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid trackingMode", () => {
    const result = inventoryItemSchema.safeParse({ ...BASE_ITEM, trackingMode: "BOTH" });
    expect(result.success).toBe(false);
  });

  it("rejects negative dailyRateAmount", () => {
    const result = inventoryItemSchema.safeParse({ ...BASE_ITEM, dailyRateAmount: -1 });
    expect(result.success).toBe(false);
  });

  it("BULK item rejects totalQuantity = 0 (FR-10B)", () => {
    const result = inventoryItemSchemaRefined.safeParse({
      ...BASE_ITEM,
      trackingMode: "BULK" as const,
      totalQuantity: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("clientSchema", () => {
  it("valid client with only required name passes", () => {
    expect(clientSchema.safeParse({ name: "Acme Corp" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(clientSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects invalid email format", () => {
    expect(clientSchema.safeParse({ name: "Acme", email: "not-an-email" }).success).toBe(false);
  });

  it("allows empty string email (treated as no email)", () => {
    expect(clientSchema.safeParse({ name: "Acme", email: "" }).success).toBe(true);
  });

  it("allows valid email", () => {
    expect(clientSchema.safeParse({ name: "Acme", email: "contact@acme.com" }).success).toBe(true);
  });
});

const BASE_LINE_ITEM = {
  description: "Lighting rig",
  quantity: 1,
  unitAmount: 10000,
};

const BASE_INVOICE = {
  projectId: "proj-1",
  clientId: "client-1",
  type: "STANDARD" as const,
  issueDate: "2026-06-01",
  dueDate: "2026-06-15",
  currencyCode: "USD",
  lineItems: [BASE_LINE_ITEM],
};

describe("invoiceSchema", () => {
  it("valid invoice passes", () => {
    expect(invoiceSchema.safeParse(BASE_INVOICE).success).toBe(true);
  });

  it("rejects invoice with no line items", () => {
    const result = invoiceSchema.safeParse({ ...BASE_INVOICE, lineItems: [] });
    expect(result.success).toBe(false);
  });

  it("rejects taxRate > 1", () => {
    const result = invoiceSchema.safeParse({ ...BASE_INVOICE, taxRate: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects missing projectId", () => {
    const result = invoiceSchema.safeParse({ ...BASE_INVOICE, projectId: "" });
    expect(result.success).toBe(false);
  });

  it("discountAmount defaults to 0", () => {
    const result = invoiceSchema.safeParse(BASE_INVOICE);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.discountAmount).toBe(0);
  });

  it("rejects line item with zero quantity", () => {
    const result = invoiceSchema.safeParse({
      ...BASE_INVOICE,
      lineItems: [{ ...BASE_LINE_ITEM, quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("paymentSchema", () => {
  const BASE_PAYMENT = {
    amount: 5000,
    currency: "USD",
    method: "BANK_TRANSFER" as const,
    receivedAt: "2026-06-10",
  };

  it("valid payment passes", () => {
    expect(paymentSchema.safeParse(BASE_PAYMENT).success).toBe(true);
  });

  it("rejects amount of 0", () => {
    expect(paymentSchema.safeParse({ ...BASE_PAYMENT, amount: 0 }).success).toBe(false);
  });

  it("rejects negative amount", () => {
    expect(paymentSchema.safeParse({ ...BASE_PAYMENT, amount: -100 }).success).toBe(false);
  });

  it("rejects invalid payment method", () => {
    expect(paymentSchema.safeParse({ ...BASE_PAYMENT, method: "CRYPTO" }).success).toBe(false);
  });
});

describe("pricingProfileSchema", () => {
  const BASE = {
    name: "Standard",
    tiers: [
      { minDays: 1, multiplier: 1.0 },
      { minDays: 7, multiplier: 3.0 },
    ],
  };

  it("valid profile passes", () => {
    expect(pricingProfileSchema.safeParse(BASE).success).toBe(true);
  });

  it("rejects a profile without a day-1 tier", () => {
    const result = pricingProfileSchema.safeParse({
      ...BASE,
      tiers: [{ minDays: 3, multiplier: 2.5 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate day breakpoints", () => {
    const result = pricingProfileSchema.safeParse({
      ...BASE,
      tiers: [
        { minDays: 1, multiplier: 1.0 },
        { minDays: 1, multiplier: 2.0 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive multiplier", () => {
    const result = pricingProfileSchema.safeParse({
      ...BASE,
      tiers: [{ minDays: 1, multiplier: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty tiers", () => {
    expect(pricingProfileSchema.safeParse({ ...BASE, tiers: [] }).success).toBe(false);
  });

  it("rejects missing name", () => {
    expect(pricingProfileSchema.safeParse({ ...BASE, name: "" }).success).toBe(false);
  });
});

describe("equipmentItemSchema — discounts", () => {
  const BASE = { inventoryItemId: "item-1", quantityNeeded: 1 };

  it("accepts a percentage discount", () => {
    expect(equipmentItemSchema.safeParse({ ...BASE, discountPercent: 0.15 }).success).toBe(true);
  });

  it("accepts a fixed discount", () => {
    expect(equipmentItemSchema.safeParse({ ...BASE, discountFixed: 500 }).success).toBe(true);
  });

  it("rejects both percent and fixed set together", () => {
    expect(
      equipmentItemSchema.safeParse({ ...BASE, discountPercent: 0.1, discountFixed: 500 }).success
    ).toBe(false);
  });

  it("rejects percent above 1", () => {
    expect(equipmentItemSchema.safeParse({ ...BASE, discountPercent: 1.5 }).success).toBe(false);
  });
});
