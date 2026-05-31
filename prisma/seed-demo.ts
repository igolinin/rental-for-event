/**
 * Demo data seed — rich, re-runnable test dataset across all modules.
 *
 *   npm run db:seed        # base data (users, categories, currencies, Standard profile)
 *   npm run db:seed:demo   # this file — adds warehouses, more inventory, crew,
 *                          # clients, projects (phases/crew/labor/kit/discounts) + invoices
 *
 * Idempotent: entities use deterministic DEMO-* refCodes and are upserted;
 * projects skip child creation if the project already exists.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d;
}

async function main() {
  console.log("🌱 Seeding demo data…");

  // ── Prerequisites from the base seed ─────────────────────────────
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    console.error("No admin user found. Run `npm run db:seed` first.");
    process.exit(1);
  }

  const catBySlug = async (slug: string) =>
    prisma.inventoryCategory.findUnique({ where: { slug } });

  const audio = await catBySlug("audio");
  const lighting = await catBySlug("lighting");
  const video = await catBySlug("video-led");
  const staging = await catBySlug("staging");
  const consumables = await catBySlug("consumables");
  if (!audio || !lighting || !video || !staging || !consumables) {
    console.error("Base categories missing. Run `npm run db:seed` first.");
    process.exit(1);
  }

  // Lock the Consumables category from discounts by default
  await prisma.inventoryCategory.update({
    where: { id: consumables.id },
    data: { defaultNoDiscount: true },
  });

  // ── Extra users (STAFF, VIEWER) ──────────────────────────────────
  const bcrypt = await import("bcryptjs");
  const pw = await bcrypt.hash("changeme123", 12);
  for (const u of [
    { email: "staff@company.com", name: "Sam Staff", role: "STAFF" as const },
    { email: "viewer@company.com", name: "Vera Viewer", role: "VIEWER" as const },
  ]) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, role: u.role, passwordHash: pw },
      update: {},
    });
  }
  console.log("✓ Extra users (staff, viewer)");

  // ── Warehouses ───────────────────────────────────────────────────
  async function warehouse(name: string, city: string) {
    const existing = await prisma.warehouse.findFirst({ where: { name } });
    if (existing) return existing;
    return prisma.warehouse.create({ data: { name, city, country: "US" } });
  }
  const mainWh = await warehouse("Main Warehouse", "New York");
  const westWh = await warehouse("West Coast Depot", "Los Angeles");
  console.log("✓ Warehouses");

  // ── Extra pricing profile ────────────────────────────────────────
  let longTerm = await prisma.pricingProfile.findFirst({ where: { name: "Long-term" } });
  if (!longTerm) {
    longTerm = await prisma.pricingProfile.create({
      data: {
        name: "Long-term",
        description: "Aggressive duration discount for multi-week and monthly rentals.",
        tiers: {
          create: [
            { minDays: 1, multiplier: 1.0 },
            { minDays: 7, multiplier: 2.5 },
            { minDays: 14, multiplier: 4.0 },
            { minDays: 30, multiplier: 6.5 },
            { minDays: 90, multiplier: 15.0 },
          ],
        },
      },
    });
  }
  console.log("✓ Long-term pricing profile");

  // ── Property definitions ─────────────────────────────────────────
  async function propDef(name: string, slug: string, valueType: "TEXT" | "NUMERIC" | "BOOLEAN", unit?: string) {
    const existing = await prisma.inventoryPropertyDef.findUnique({ where: { slug } });
    if (existing) return existing;
    return prisma.inventoryPropertyDef.create({ data: { name, slug, valueType, unit: unit ?? null } });
  }
  const powerDef = await propDef("Power", "power", "NUMERIC", "W");
  const weightDef = await propDef("Weight", "weight", "NUMERIC", "kg");
  const weatherDef = await propDef("Weatherproof (IP65)", "weatherproof", "BOOLEAN");
  console.log("✓ Property definitions");

  // ── Inventory items ──────────────────────────────────────────────
  type ItemSpec = {
    refCode: string;
    name: string;
    description: string;
    categoryId: string;
    trackingMode: "SERIALIZED" | "BULK";
    dailyRateAmount: number;
    replacementCostAmount: number;
    totalQuantity?: number;
    units?: number;
    warehouseId?: string;
    noDiscount?: boolean;
    pricingProfileId?: string | null;
    props?: { defId: string; numeric?: number; boolean?: boolean }[];
  };

  const items: ItemSpec[] = [
    {
      refCode: "DEMO-AUD-001", name: "L-Acoustics K2 Line Array", description: "Variable-curvature line source element",
      categoryId: audio.id, trackingMode: "SERIALIZED", dailyRateAmount: 18000, replacementCostAmount: 1500000,
      units: 8, warehouseId: mainWh.id,
      props: [{ defId: powerDef.id, numeric: 1000 }, { defId: weightDef.id, numeric: 56 }],
    },
    {
      refCode: "DEMO-AUD-002", name: "DiGiCo SD12 Console", description: "96-channel digital mixing console",
      categoryId: audio.id, trackingMode: "SERIALIZED", dailyRateAmount: 25000, replacementCostAmount: 4500000,
      units: 2, warehouseId: mainWh.id,
    },
    {
      refCode: "DEMO-LGT-001", name: "Martin MAC Aura XB", description: "LED wash moving head with aura backlight",
      categoryId: lighting.id, trackingMode: "SERIALIZED", dailyRateAmount: 6000, replacementCostAmount: 320000,
      units: 12, warehouseId: westWh.id, pricingProfileId: longTerm.id,
      props: [{ defId: powerDef.id, numeric: 260 }, { defId: weatherDef.id, boolean: false }],
    },
    {
      refCode: "DEMO-LGT-002", name: "Robe BMFL Spot", description: "High-output profile moving head",
      categoryId: lighting.id, trackingMode: "SERIALIZED", dailyRateAmount: 9500, replacementCostAmount: 850000,
      units: 6, warehouseId: westWh.id,
    },
    {
      refCode: "DEMO-VID-001", name: 'ROE Visual CB5 LED Panel 50cm', description: "5.77mm pitch outdoor/indoor LED panel",
      categoryId: video.id, trackingMode: "SERIALIZED", dailyRateAmount: 4000, replacementCostAmount: 280000,
      units: 48, warehouseId: mainWh.id,
      props: [{ defId: weatherDef.id, boolean: true }],
    },
    {
      refCode: "DEMO-STG-001", name: "StageDeck 2m × 1m Platform", description: "Adjustable-height staging deck",
      categoryId: staging.id, trackingMode: "BULK", dailyRateAmount: 1500, replacementCostAmount: 45000,
      totalQuantity: 40, warehouseId: mainWh.id,
    },
    {
      refCode: "DEMO-CON-001", name: "Gaffer Tape 50mm (Black)", description: "Matte cloth gaffer tape roll",
      categoryId: consumables.id, trackingMode: "BULK", dailyRateAmount: 100, replacementCostAmount: 1800,
      totalQuantity: 200, noDiscount: true,
    },
    {
      refCode: "DEMO-CON-002", name: "Cable Ties (pack of 100)", description: "Reusable hook-and-loop cable ties",
      categoryId: consumables.id, trackingMode: "BULK", dailyRateAmount: 50, replacementCostAmount: 1200,
      totalQuantity: 150, noDiscount: true,
    },
  ];

  const itemByRef: Record<string, string> = {};
  for (const spec of items) {
    const item = await prisma.inventoryItem.upsert({
      where: { refCode: spec.refCode },
      create: {
        refCode: spec.refCode,
        name: spec.name,
        description: spec.description,
        categoryId: spec.categoryId,
        trackingMode: spec.trackingMode,
        totalQuantity: spec.trackingMode === "BULK" ? spec.totalQuantity ?? 0 : 0,
        dailyRateAmount: spec.dailyRateAmount,
        replacementCostAmount: spec.replacementCostAmount,
        pricingProfileId: spec.pricingProfileId ?? null,
        noDiscount: spec.noDiscount ?? false,
      },
      update: {},
    });
    itemByRef[spec.refCode] = item.id;

    // Serialized units
    if (spec.trackingMode === "SERIALIZED" && spec.units) {
      for (let i = 1; i <= spec.units; i++) {
        const serial = `${spec.refCode}-U${String(i).padStart(2, "0")}`;
        await prisma.serializedUnit.upsert({
          where: { inventoryItemId_serialNumber: { inventoryItemId: item.id, serialNumber: serial } },
          create: {
            inventoryItemId: item.id,
            serialNumber: serial,
            assetTag: serial,
            status: i % 13 === 0 ? "IN_REPAIR" : "AVAILABLE",
            warehouseId: spec.warehouseId ?? null,
          },
          update: {},
        });
      }
    }

    // Bulk warehouse stock
    if (spec.trackingMode === "BULK" && spec.warehouseId && spec.totalQuantity) {
      await prisma.inventoryItemWarehouseStock.upsert({
        where: { inventoryItemId_warehouseId: { inventoryItemId: item.id, warehouseId: spec.warehouseId } },
        create: { inventoryItemId: item.id, warehouseId: spec.warehouseId, quantity: spec.totalQuantity },
        update: {},
      });
    }

    // Properties
    for (const p of spec.props ?? []) {
      await prisma.inventoryItemProperty.upsert({
        where: { inventoryItemId_propertyDefId: { inventoryItemId: item.id, propertyDefId: p.defId } },
        create: {
          inventoryItemId: item.id,
          propertyDefId: p.defId,
          numericValue: p.numeric ?? null,
          booleanValue: p.boolean ?? null,
        },
        update: {},
      });
    }
  }
  console.log(`✓ ${items.length} inventory items (+units, stock, properties)`);

  // ── Clients ──────────────────────────────────────────────────────
  const clientSpecs = [
    { refCode: "DEMO-CLI-001", name: "Skyline Festivals LLC", contactName: "Dana Reed", email: "dana@skylinefest.com", city: "Austin" },
    { refCode: "DEMO-CLI-002", name: "Metro Conference Center", contactName: "Liam Wu", email: "liam@metrocc.com", city: "Chicago" },
    { refCode: "DEMO-CLI-003", name: "Northwind Theatre Co.", contactName: "Priya Patel", email: "priya@northwind.org", city: "Seattle" },
  ];
  const clientByRef: Record<string, string> = {};
  for (const c of clientSpecs) {
    const client = await prisma.client.upsert({
      where: { refCode: c.refCode },
      create: { ...c, country: "US" },
      update: {},
    });
    clientByRef[c.refCode] = client.id;
  }
  console.log(`✓ ${clientSpecs.length} clients`);

  // ── Crew ─────────────────────────────────────────────────────────
  const crewSpecs = [
    { refCode: "DEMO-CRW-001", firstName: "Devin", lastName: "Marsh", role: "Audio Engineer", type: "EMPLOYEE" as const, reg: 7000 },
    { refCode: "DEMO-CRW-002", firstName: "Yuki", lastName: "Tanaka", role: "Lighting Designer", type: "EMPLOYEE" as const, reg: 8000 },
    { refCode: "DEMO-CRW-003", firstName: "Omar", lastName: "Haddad", role: "Video Engineer", type: "FREELANCER" as const, reg: 9000 },
    { refCode: "DEMO-CRW-004", firstName: "Bea", lastName: "Lindqvist", role: "Stage Manager", type: "EMPLOYEE" as const, reg: 7500 },
    { refCode: "DEMO-CRW-005", firstName: "Carlos", lastName: "Mendez", role: "Rigger", type: "FREELANCER" as const, reg: 8500 },
  ];
  const crewByRef: Record<string, string> = {};
  for (const c of crewSpecs) {
    const crew = await prisma.crewMember.upsert({
      where: { refCode: c.refCode },
      create: {
        refCode: c.refCode, firstName: c.firstName, lastName: c.lastName,
        email: `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase()}@crew.demo`,
        role: c.role, type: c.type,
      },
      update: {},
    });
    crewByRef[c.refCode] = crew.id;
    const rateCount = await prisma.crewRate.count({ where: { crewMemberId: crew.id } });
    if (rateCount === 0) {
      await prisma.crewRate.createMany({
        data: [
          { crewMemberId: crew.id, rateType: "REGULAR", amount: c.reg },
          { crewMemberId: crew.id, rateType: "OVERTIME", amount: Math.round(c.reg * 1.5) },
          { crewMemberId: crew.id, rateType: "DOUBLE_TIME", amount: c.reg * 2 },
          { crewMemberId: crew.id, rateType: "PER_DIEM", amount: 12000 },
        ],
      });
    }
  }
  console.log(`✓ ${crewSpecs.length} crew members (+rates)`);

  // ── Projects (with phases, crew, labor, kit, discounts, invoice) ──
  type ProjSpec = {
    refCode: string; name: string; clientRef: string; type: "SINGLE_EVENT" | "MULTI_DAY_TOUR" | "LONG_TERM_RENTAL";
    status: "INQUIRY" | "QUOTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED";
    startOffset: number; endOffset: number; venue: string;
    discountPercent?: number; kit: { ref: string; qty: number; days: number; discountPercent?: number }[];
    crew: string[]; withInvoice?: boolean;
  };

  const projects: ProjSpec[] = [
    {
      refCode: "DEMO-PRJ-001", name: "Skyline Summer Festival", clientRef: "DEMO-CLI-001",
      type: "MULTI_DAY_TOUR", status: "CONFIRMED", startOffset: 14, endOffset: 17, venue: "Zilker Park",
      discountPercent: 0.1,
      kit: [
        { ref: "DEMO-AUD-001", qty: 6, days: 3 },
        { ref: "DEMO-AUD-002", qty: 1, days: 3 },
        { ref: "DEMO-LGT-001", qty: 8, days: 3, discountPercent: 0.2 },
        { ref: "DEMO-CON-001", qty: 10, days: 3 },
      ],
      crew: ["DEMO-CRW-001", "DEMO-CRW-002", "DEMO-CRW-005"],
      withInvoice: true,
    },
    {
      refCode: "DEMO-PRJ-002", name: "Metro Tech Conference", clientRef: "DEMO-CLI-002",
      type: "SINGLE_EVENT", status: "IN_PROGRESS", startOffset: -2, endOffset: 1, venue: "Metro Hall A",
      kit: [
        { ref: "DEMO-VID-001", qty: 24, days: 2 },
        { ref: "DEMO-AUD-002", qty: 1, days: 2 },
        { ref: "DEMO-STG-001", qty: 12, days: 2 },
      ],
      crew: ["DEMO-CRW-003", "DEMO-CRW-004"],
    },
    {
      refCode: "DEMO-PRJ-003", name: "Northwind Winter Production", clientRef: "DEMO-CLI-003",
      type: "LONG_TERM_RENTAL", status: "QUOTED", startOffset: 40, endOffset: 70, venue: "Northwind Mainstage",
      kit: [
        { ref: "DEMO-LGT-002", qty: 6, days: 30 },
        { ref: "DEMO-LGT-001", qty: 4, days: 30 },
      ],
      crew: ["DEMO-CRW-002"],
    },
  ];

  for (const p of projects) {
    const existing = await prisma.project.findUnique({ where: { refCode: p.refCode } });
    if (existing) continue; // don't duplicate children on re-run

    const project = await prisma.project.create({
      data: {
        refCode: p.refCode,
        name: p.name,
        type: p.type,
        status: p.status,
        clientId: clientByRef[p.clientRef],
        venue: p.venue,
        startAt: daysFromNow(p.startOffset),
        endAt: daysFromNow(p.endOffset),
        loadInAt: daysFromNow(p.startOffset - 1),
        loadOutAt: daysFromNow(p.endOffset + 1),
        currencyCode: "USD",
        taxRate: 0.0875,
        discountPercent: p.discountPercent ?? null,
        createdById: admin.id,
      },
    });

    // Phases
    const phaseDefs: { name: "LOAD_IN" | "SETUP" | "SHOW" | "STRIKE"; off: number }[] = [
      { name: "LOAD_IN", off: p.startOffset - 1 },
      { name: "SETUP", off: p.startOffset },
      { name: "SHOW", off: p.startOffset + 1 },
      { name: "STRIKE", off: p.endOffset },
    ];
    const phaseIds: string[] = [];
    for (let i = 0; i < phaseDefs.length; i++) {
      const ph = await prisma.projectPhase.create({
        data: {
          projectId: project.id,
          name: phaseDefs[i].name,
          startAt: daysFromNow(phaseDefs[i].off),
          endAt: daysFromNow(phaseDefs[i].off),
          sortOrder: i,
        },
      });
      phaseIds.push(ph.id);
    }

    // Kit lines
    for (let i = 0; i < p.kit.length; i++) {
      const k = p.kit[i];
      const inv = await prisma.inventoryItem.findUnique({ where: { id: itemByRef[k.ref] } });
      await prisma.projectEquipmentItem.create({
        data: {
          projectId: project.id,
          inventoryItemId: itemByRef[k.ref],
          quantityNeeded: k.qty,
          rateDays: k.days,
          unitRateAmount: inv?.dailyRateAmount ?? 0,
          unitRateCurrency: "USD",
          rateType: "DAILY",
          discountPercent: k.discountPercent ?? null,
          sortOrder: i,
        },
      });
    }

    // Crew assignments (attached to the SETUP phase)
    for (const cref of p.crew) {
      await prisma.crewAssignment.create({
        data: {
          projectId: project.id,
          crewMemberId: crewByRef[cref],
          phaseId: phaseIds[1],
          startAt: daysFromNow(p.startOffset),
          endAt: daysFromNow(p.endOffset),
          role: "Crew",
        },
      });
    }

    // A labor subcontract (stage hands)
    await prisma.laborSubcontract.create({
      data: {
        projectId: project.id,
        phaseId: phaseIds[0],
        vendorName: "QuickCrew Staffing",
        role: "Stagehands",
        quantity: 4,
        startAt: daysFromNow(p.startOffset - 1),
        endAt: daysFromNow(p.startOffset),
        dailyRateAmount: 22000,
        status: p.status === "QUOTED" ? "REQUESTED" : "CONFIRMED",
      },
    });

    // A project expense
    await prisma.projectExpense.create({
      data: {
        projectId: project.id,
        description: "Box truck rental",
        category: "TRANSPORT",
        amount: 45000,
        currency: "USD",
        date: daysFromNow(p.startOffset - 1),
      },
    });

    // Invoice for confirmed projects
    if (p.withInvoice) {
      const lines = p.kit.map((k) => {
        const days = k.days;
        // simple gross: dailyRate × days × qty (curve/discount shown in app, invoice is editable)
        return { ref: k.ref, qty: k.qty, days };
      });
      let subtotal = 0;
      const lineItemData = [];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const inv = await prisma.inventoryItem.findUnique({ where: { id: itemByRef[l.ref] } });
        const unit = (inv?.dailyRateAmount ?? 0) * l.days;
        const total = unit * l.qty;
        subtotal += total;
        lineItemData.push({
          description: `${inv?.name} — ${l.days} day(s)`,
          quantity: l.qty,
          unitAmount: unit,
          totalAmount: total,
          sortOrder: i,
        });
      }
      const tax = Math.round(subtotal * 0.0875);
      await prisma.invoice.create({
        data: {
          refCode: `${p.refCode}-INV`,
          projectId: project.id,
          clientId: clientByRef[p.clientRef],
          status: "SENT",
          type: "STANDARD",
          issueDate: daysFromNow(p.startOffset - 5),
          dueDate: daysFromNow(p.startOffset + 25),
          currencyCode: "USD",
          subtotalAmount: subtotal,
          taxAmount: tax,
          totalAmount: subtotal + tax,
          createdById: admin.id,
          lineItems: { create: lineItemData },
        },
      });
    }

    console.log(`✓ Project ${p.name} (${p.kit.length} kit lines, ${p.crew.length} crew)`);
  }

  console.log("\n✅ Demo data seeded!");
  console.log("   Extra logins: staff@company.com / viewer@company.com (changeme123)");
}

main()
  .catch((e) => {
    console.error("❌ Demo seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
