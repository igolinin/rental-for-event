import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── System Settings ──────────────────────────────────────────
  await prisma.systemSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      companyName: "Event Rental Co.",
      defaultCurrencyCode: "USD",
      invoiceTermsDays: 30,
      otDailyThreshold: 8,
      otWeeklyThreshold: 40,
    },
    update: {},
  });

  // ── Currencies ────────────────────────────────────────────────
  const currencies = [
    { code: "USD", name: "US Dollar", symbol: "$", isBaseCurrency: true, exchangeRate: 1.0 },
    { code: "EUR", name: "Euro", symbol: "€", isBaseCurrency: false, exchangeRate: 0.92 },
    { code: "GBP", name: "British Pound", symbol: "£", isBaseCurrency: false, exchangeRate: 0.79 },
    { code: "CAD", name: "Canadian Dollar", symbol: "CA$", isBaseCurrency: false, exchangeRate: 1.36 },
  ];

  for (const currency of currencies) {
    await prisma.currencyConfig.upsert({
      where: { code: currency.code },
      create: currency,
      update: { exchangeRate: currency.exchangeRate },
    });
  }
  console.log("✓ Currencies seeded");

  // ── Admin User ────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("changeme123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@company.com" },
    create: {
      name: "Admin User",
      email: "admin@company.com",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
    update: {},
  });
  console.log("✓ Admin user: admin@company.com / changeme123");

  // ── Manager User ──────────────────────────────────────────────
  const managerPassword = await bcrypt.hash("changeme123", 12);
  await prisma.user.upsert({
    where: { email: "manager@company.com" },
    create: {
      name: "Production Manager",
      email: "manager@company.com",
      passwordHash: managerPassword,
      role: UserRole.MANAGER,
    },
    update: {},
  });
  console.log("✓ Manager user: manager@company.com / changeme123");

  // ── Inventory Categories ───────────────────────────────────────
  const categories = [
    { name: "Audio", slug: "audio", color: "#3B82F6", sortOrder: 1 },
    { name: "Lighting", slug: "lighting", color: "#F59E0B", sortOrder: 2 },
    { name: "Video / LED", slug: "video-led", color: "#8B5CF6", sortOrder: 3 },
    { name: "Staging", slug: "staging", color: "#10B981", sortOrder: 4 },
    { name: "Consumables", slug: "consumables", color: "#6B7280", sortOrder: 5 },
  ];

  for (const cat of categories) {
    await prisma.inventoryCategory.upsert({
      where: { slug: cat.slug },
      create: cat,
      update: {},
    });
  }
  console.log("✓ Inventory categories seeded");

  // ── Audio Sub-categories ──────────────────────────────────────
  const audioCategory = await prisma.inventoryCategory.findUnique({
    where: { slug: "audio" },
  });

  if (audioCategory) {
    const audioSubcats = [
      { name: "PA Systems", slug: "pa-systems" },
      { name: "Microphones", slug: "microphones" },
      { name: "Mixers & Consoles", slug: "mixers-consoles" },
      { name: "Signal Processing", slug: "signal-processing" },
      { name: "Amplifiers", slug: "amplifiers" },
      { name: "Cables & Accessories", slug: "cables-accessories" },
    ];

    for (const sub of audioSubcats) {
      await prisma.inventorySubCategory.upsert({
        where: { categoryId_slug: { categoryId: audioCategory.id, slug: sub.slug } },
        create: { ...sub, categoryId: audioCategory.id },
        update: {},
      });
    }
  }

  // ── Lighting Sub-categories ───────────────────────────────────
  const lightingCategory = await prisma.inventoryCategory.findUnique({
    where: { slug: "lighting" },
  });

  if (lightingCategory) {
    const lightingSubcats = [
      { name: "Moving Heads", slug: "moving-heads" },
      { name: "LED Fixtures", slug: "led-fixtures" },
      { name: "Dimmer Racks", slug: "dimmer-racks" },
      { name: "Controllers", slug: "controllers" },
      { name: "Truss & Rigging", slug: "truss-rigging" },
    ];

    for (const sub of lightingSubcats) {
      await prisma.inventorySubCategory.upsert({
        where: { categoryId_slug: { categoryId: lightingCategory.id, slug: sub.slug } },
        create: { ...sub, categoryId: lightingCategory.id },
        update: {},
      });
    }
  }

  console.log("✓ Sub-categories seeded");

  // ── Sample Inventory Items ─────────────────────────────────────
  const micSubcat = await prisma.inventorySubCategory.findFirst({
    where: { slug: "microphones" },
  });

  const audioId = audioCategory?.id ?? "";
  const lightingId = lightingCategory?.id ?? "";

  // Sample serialized item (microphone)
  const sm58 = await prisma.inventoryItem.upsert({
    where: { refCode: "AUD-MIC-001" },
    create: {
      refCode: "AUD-MIC-001",
      name: "Shure SM58 Vocal Microphone",
      description: "Industry-standard dynamic vocal microphone",
      categoryId: audioId,
      subCategoryId: micSubcat?.id,
      trackingMode: "SERIALIZED",
      dailyRateAmount: 1500, // $15.00/day
      dailyRateCurrency: "USD",
      replacementCostAmount: 9900, // $99.00
      replacementCostCurrency: "USD",
    },
    update: {},
  });

  // Add sample serial units for SM58
  const sm58Units = [
    { serialNumber: "SM58-001", assetTag: "A001" },
    { serialNumber: "SM58-002", assetTag: "A002" },
    { serialNumber: "SM58-003", assetTag: "A003" },
  ];

  for (const unit of sm58Units) {
    await prisma.serializedUnit.upsert({
      where: {
        inventoryItemId_serialNumber: {
          inventoryItemId: sm58.id,
          serialNumber: unit.serialNumber,
        },
      },
      create: {
        inventoryItemId: sm58.id,
        serialNumber: unit.serialNumber,
        assetTag: unit.assetTag,
        status: "AVAILABLE",
        purchasePriceAmount: 9900,
        purchasePriceCurrency: "USD",
      },
      update: {},
    });
  }

  // Sample bulk item (XLR cables)
  const cablesCat = await prisma.inventorySubCategory.findFirst({
    where: { slug: "cables-accessories" },
  });

  await prisma.inventoryItem.upsert({
    where: { refCode: "AUD-CBL-001" },
    create: {
      refCode: "AUD-CBL-001",
      name: "XLR Cable 10m",
      description: "Balanced XLR microphone cable, 10 meters",
      categoryId: audioId,
      subCategoryId: cablesCat?.id,
      trackingMode: "BULK",
      totalQuantity: 50,
      dailyRateAmount: 200, // $2.00/day
      dailyRateCurrency: "USD",
      replacementCostAmount: 2500, // $25.00
      replacementCostCurrency: "USD",
    },
    update: {},
  });

  // Sample serialized moving head light
  const movingHeadSubcat = await prisma.inventorySubCategory.findFirst({
    where: { slug: "moving-heads" },
  });

  const movingHead = await prisma.inventoryItem.upsert({
    where: { refCode: "LGT-MH-001" },
    create: {
      refCode: "LGT-MH-001",
      name: "Chauvet Rogue R2 Spot",
      description: "160W LED moving head spot fixture",
      categoryId: lightingId,
      subCategoryId: movingHeadSubcat?.id,
      trackingMode: "SERIALIZED",
      dailyRateAmount: 7500, // $75.00/day
      dailyRateCurrency: "USD",
      replacementCostAmount: 250000, // $2,500.00
      replacementCostCurrency: "USD",
    },
    update: {},
  });

  // Add units for moving head
  for (let i = 1; i <= 4; i++) {
    await prisma.serializedUnit.upsert({
      where: {
        inventoryItemId_serialNumber: {
          inventoryItemId: movingHead.id,
          serialNumber: `RGR2-00${i}`,
        },
      },
      create: {
        inventoryItemId: movingHead.id,
        serialNumber: `RGR2-00${i}`,
        assetTag: `L00${i}`,
        status: "AVAILABLE",
      },
      update: {},
    });
  }

  console.log("✓ Sample inventory items seeded");

  // ── Sample Client ─────────────────────────────────────────────
  await prisma.client.upsert({
    where: { refCode: "CLI-001" },
    create: {
      refCode: "CLI-001",
      name: "Acme Events Corp",
      contactName: "Jane Smith",
      email: "jane@acmeevents.com",
      phone: "+1 555-0100",
      city: "New York",
      country: "US",
    },
    update: {},
  });

  console.log("✓ Sample client seeded");

  // ── Sample Crew Members ───────────────────────────────────────
  const fohEngineer = await prisma.crewMember.upsert({
    where: { refCode: "CRW-001" },
    create: {
      refCode: "CRW-001",
      firstName: "Alex",
      lastName: "Johnson",
      email: "alex@company.com",
      phone: "+1 555-0200",
      type: "EMPLOYEE",
      role: "FOH Engineer",
    },
    update: {},
  });

  // Add rates for crew member
  await prisma.crewRate.deleteMany({ where: { crewMemberId: fohEngineer.id } });
  await prisma.crewRate.createMany({
    data: [
      { crewMemberId: fohEngineer.id, rateType: "REGULAR", amount: 6500, currency: "USD" },       // $65/hr
      { crewMemberId: fohEngineer.id, rateType: "OVERTIME", amount: 9750, currency: "USD" },      // $97.50/hr
      { crewMemberId: fohEngineer.id, rateType: "DOUBLE_TIME", amount: 13000, currency: "USD" },  // $130/hr
      { crewMemberId: fohEngineer.id, rateType: "PER_DIEM", amount: 10000, currency: "USD" },     // $100/day
    ],
  });

  await prisma.crewMember.upsert({
    where: { refCode: "CRW-002" },
    create: {
      refCode: "CRW-002",
      firstName: "Maria",
      lastName: "Garcia",
      email: "maria.garcia@freelance.com",
      phone: "+1 555-0201",
      type: "FREELANCER",
      role: "Lighting Technician",
    },
    update: {},
  });

  console.log("✓ Sample crew members seeded");

  // ── Default pricing profile ───────────────────────────────────
  const existingDefault = await prisma.pricingProfile.findFirst({ where: { name: "Standard" } });
  if (!existingDefault) {
    await prisma.pricingProfile.create({
      data: {
        name: "Standard",
        description: "Default duration-based rate card. Longer rentals get a lower effective per-day price.",
        isDefault: true,
        isSystem: true,
        tiers: {
          create: [
            { minDays: 1, multiplier: 1.0 },
            { minDays: 2, multiplier: 1.8 },
            { minDays: 3, multiplier: 2.5 },
            { minDays: 7, multiplier: 3.0 },
            { minDays: 14, multiplier: 5.0 },
            { minDays: 30, multiplier: 9.0 },
          ],
        },
      },
    });
    console.log("✓ Standard pricing profile seeded");
  }

  console.log("\n✅ Database seeded successfully!");
  console.log("\nDefault credentials:");
  console.log("  Admin:   admin@company.com / changeme123");
  console.log("  Manager: manager@company.com / changeme123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
