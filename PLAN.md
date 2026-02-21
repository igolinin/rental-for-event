# Event Rental & Production Management — Project Plan

## Context

A greenfield full-stack TypeScript web application for an event rental and production company. The system manages the full operational lifecycle: equipment inventory, project/event booking, crew scheduling, time tracking, maintenance, invoicing, and reporting.

---

## Confirmed Decisions

| Concern | Decision |
|---------|----------|
| Framework | Next.js 15 (App Router) + TypeScript |
| ORM | Prisma 6 + PostgreSQL |
| Auth | NextAuth v5 (Auth.js) |
| UI | shadcn/ui + Tailwind CSS |
| Deployment | Vercel (app) + Neon/Railway (PostgreSQL) |
| Users | Small team (1–10), single organization |
| Integrations | None in Phase 1 — email, payments, accounting deferred |
| Inventory | Hybrid: serialized (high-value) + bulk (consumables) |
| Crew | Mix of employees and freelancers |
| Currency | Multi-currency with manual exchange rates |
| Invoicing | Basic PDF + utilization/revenue reports |

---

## Functional Requirements

### FR-01: Authentication & Authorization
- Credentials login (email + password, bcrypt)
- Roles: `ADMIN`, `MANAGER`, `STAFF`, `VIEWER`
- ADMIN can manage users and system settings
- All dashboard routes require authentication

### FR-02: Inventory Management
- Categories: Audio, Lighting, Video/LED, Staging (+ sub-categories)
- **SERIALIZED** tracking — individual units with serial numbers, asset tags, purchase info
- **BULK** tracking — quantity pool (cables, expendables, consumables)
- Daily/weekly rental rate defaults per item
- Replacement cost tracking
- Availability checking over a date range (considers bookings + items in repair)
- Search/filter by category, status, availability date

### FR-03: Maintenance Tracking
- Log maintenance events against items or specific serialized units
- Types: Scheduled Service, Repair, Inspection, Cleaning, Calibration
- Status flow: `Open → In Progress → Completed`
- `Open`/`In Progress` → serialized unit marked `IN_REPAIR` (unavailable for booking)
- `Completed` → unit returns to `AVAILABLE`
- Track repair vendor, technician, cost per log entry
- Global maintenance queue across all inventory
- Full service history per item/unit

### FR-04: Client Management
- Client records: name, contact, email, phone, address, tax ID
- Client history: linked projects and invoices

### FR-05: Project / Event Management
- Types: `SINGLE_EVENT`, `MULTI_DAY_TOUR`, `LONG_TERM_RENTAL`
- Status flow: `Inquiry → Quoted → Confirmed → In Progress → Completed → Cancelled`
- Load-in / Start / End / Load-out date tracking
- Venue and location details
- Equipment kit list (line items with availability validation)
- Sub-rental tracking (gear rented from external vendors)
- Project expenses (fuel, accommodation, misc)
- Project finances view: equipment revenue, sub-rental costs, labor costs, gross margin

### FR-06: Crew Management
- Crew roster: employees and freelancers
- Profile: contact info, role specialty, emergency contact, tax ID
- Rate tiers per crew member with effective dates:
  - Regular, Overtime, Double-Time, Travel Day, Per Diem
- Availability conflict checking when assigning to projects

### FR-07: Time Tracking
- Manual shift entry: clock-in / clock-out per crew member per project
- Time types: Work, Travel, Per Diem
- Configurable OT thresholds (default: 8h/day, 40h/week)
- Auto-calculate Regular / Overtime / Double-Time hour splits on approval
- Rate snapshot on approval (prevents retroactive rate changes)
- Timesheet workflow: `Draft → Submitted → Approved / Rejected`
- Crew expense submissions with approval workflow

### FR-08: Sub-Rental Management
- Track gear rented from external vendors for a project
- Status: `Requested → Confirmed → Received → Returned`
- Line items with vendor-quoted rates
- Sub-rental costs roll into project P&L

### FR-09: Invoicing
- Generate invoice from project (auto-populate from kit list)
- Invoice types: Deposit, Standard, Final
- Manual line item editing and addition
- Tax rate per invoice (configurable)
- Flat or percentage discount
- Status: `Draft → Sent → Partially Paid → Paid → Overdue → Void`
- Partial payment recording
- Server-side PDF invoice generation (`@react-pdf/renderer`)
- Multi-currency support

### FR-10: Reporting
- **Inventory Utilization**: booked days vs available days per item, revenue generated
- **Revenue**: revenue by project / client / month, gross margin per project
- **Crew Labor Summary**: hours and cost per crew member per project, OT breakdown
- PDF export for all reports

### FR-11: Settings
- Company profile (name, logo, address, email, phone)
- Default currency and tax rate
- Invoice payment terms and notes
- Active currencies with manual exchange rates
- System-wide OT policy (daily/weekly thresholds)

---

## Tech Stack

| Concern | Package |
|---------|---------|
| Framework | `next@15`, `react@19`, `typescript@5` |
| ORM | `prisma@6`, `@prisma/client@6` |
| Auth | `next-auth@5` + `bcryptjs` |
| UI components | `shadcn/ui` + `@radix-ui/*` |
| Styling | `tailwindcss@3` + `clsx` + `tailwind-merge` |
| Forms | `react-hook-form@7` + `zod@3` |
| Tables | `@tanstack/react-table@8` |
| Dates | `date-fns@4` + `date-fns-tz` + `react-day-picker@9` |
| Money | `dinero.js@2` + `@dinero.js/currencies` |
| PDF | `@react-pdf/renderer@4` |
| Client state | `zustand@5` |
| Icons | `lucide-react` |
| Misc | `nanoid`, `sharp` |

---

## Project Structure

```
rental-for-event/
├── prisma/
│   ├── schema.prisma            ← All models defined up front
│   ├── migrations/
│   └── seed.ts
├── public/
├── src/
│   ├── app/
│   │   ├── (auth)/login/        ← Login page
│   │   ├── (dashboard)/         ← All protected routes
│   │   │   ├── layout.tsx       ← Sidebar + session guard
│   │   │   ├── page.tsx         ← Dashboard / KPIs
│   │   │   ├── inventory/
│   │   │   ├── projects/
│   │   │   ├── crew/
│   │   │   ├── clients/
│   │   │   ├── sub-rentals/
│   │   │   ├── maintenance/     ← Global maintenance queue
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       ├── pdf/invoice/[id]/
│   │       └── pdf/report/
│   ├── components/
│   │   ├── ui/                  ← shadcn generated components
│   │   ├── layout/              ← Sidebar, header, breadcrumbs
│   │   ├── tables/              ← Generic DataTable + column definitions
│   │   ├── forms/
│   │   ├── inventory/
│   │   ├── projects/
│   │   ├── crew/
│   │   ├── pdf/                 ← Invoice and report PDF templates
│   │   └── shared/
│   ├── lib/
│   │   ├── prisma.ts            ← Singleton Prisma client
│   │   ├── auth.ts              ← NextAuth config
│   │   ├── availability.ts      ← Inventory availability algorithm
│   │   ├── payroll.ts           ← Overtime calculation engine
│   │   ├── currency.ts          ← Dinero.js wrapper
│   │   ├── pdf.ts
│   │   └── utils.ts
│   ├── server/
│   │   ├── actions/             ← Server Actions (all mutations)
│   │   │   ├── inventory.ts
│   │   │   ├── projects.ts
│   │   │   ├── crew.ts
│   │   │   ├── clients.ts
│   │   │   ├── timesheets.ts
│   │   │   ├── maintenance.ts
│   │   │   ├── sub-rentals.ts
│   │   │   └── invoices.ts
│   │   └── queries/             ← Data fetching (React Server Components)
│   │       ├── inventory.ts
│   │       ├── projects.ts
│   │       ├── crew.ts
│   │       ├── clients.ts
│   │       ├── reports.ts
│   │       └── dashboard.ts
│   ├── schemas/                 ← Zod validation (shared server + client)
│   └── types/                   ← Domain types beyond Prisma generated types
├── .env.example
├── components.json              ← shadcn/ui config
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Data Model (Key Entities)

```
User                    — Auth, roles (ADMIN/MANAGER/STAFF/VIEWER)
Client                  — Client records with refCode
InventoryCategory       — Audio, Lighting, Video/LED, Staging
InventorySubCategory
InventoryItem           — trackingMode: SERIALIZED | BULK, rates, costs
  SerializedUnit        — Individual units: serial number, status, purchase info
MaintenanceLog          — Against InventoryItem or SerializedUnit; syncs unit status
Project                 — type, status, dates, currency, client
  ProjectEquipmentItem  — Kit list line items with rate overrides
  ProjectEquipmentAllocation — Links SerializedUnits to line items
  ProjectExpense        — Fuel, hotel, misc project costs
SubRental               — Vendor sub-rentals per project
  SubRentalItem         — Line items for sub-rentals
CrewMember              — type: EMPLOYEE | FREELANCER
  CrewRate              — Rate tiers with effectiveFrom/effectiveTo dates
CrewAssignment          — Crew assigned to project for a date range
Timesheet               — Clock-in/out, time type, OT calc, approval, rate snapshot
CrewExpense             — Crew reimbursements with approval workflow
Invoice                 — Generated from project, multi-currency, status workflow
  InvoiceLineItem
  InvoicePayment        — Partial payment support
CurrencyConfig          — Active currencies with manual exchange rates
SystemSettings          — Company profile, defaults (singleton row)
```

**Money convention:** All amounts stored as `Int` (cents/smallest unit) + `String` currency code. Never float. All arithmetic via `dinero.js`.

---

## Critical Algorithms

### Availability (`src/lib/availability.ts`)
- Unified interface: `getAvailableQuantity(itemId, startAt, endAt, excludeProjectId?)`
- **SERIALIZED**: count units not allocated to overlapping projects AND not `IN_REPAIR`
- **BULK**: `totalQuantity` minus allocated quantity across overlapping date ranges

### Overtime (`src/lib/payroll.ts`)
- Configurable daily (default 8h) and weekly (default 40h) thresholds
- Per-day: hours > daily → OT; hours > double-time threshold → DT
- Per-week: weekly regular total > 40h → remaining → OT
- Returns `{ regularHours, overtimeHours, doubleTimeHours }`
- Rates snapshotted on timesheet approval

### PDF Generation
- Server-side only via API routes: `/api/pdf/invoice/[id]`, `/api/pdf/report/`
- `@react-pdf/renderer` — React components compiled to binary PDF
- `Content-Type: application/pdf`, `Cache-Control: private, max-age=60`

---

## Development Phases

| Phase | Scope |
|-------|-------|
| **1** | Foundation: Next.js setup, Prisma schema, Auth, Sidebar layout, User mgmt, Deploy |
| **2** | Inventory: Categories, items (both tracking modes), serialized units, maintenance |
| **3** | Projects & Clients: Client CRUD, project lifecycle, kit list, sub-rentals, P&L view |
| **4** | Crew & Time Tracking: Roster, rates, assignments, timesheets, OT calc, expenses |
| **5** | Invoicing: Invoice creation, PDF generation, payment tracking |
| **6** | Reporting: Utilization, revenue, labor reports; dashboard KPIs |
| **7** | Polish: Error handling, loading states, security review, responsive layout |

---

## Environment Variables

```bash
# .env.local (copy from .env.example)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/rental_db?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate: openssl rand -base64 32>"
NEXT_PUBLIC_APP_NAME="Event Rental Manager"
```

---

## End-to-End Verification Checklist

- [ ] Login with seeded admin credentials
- [ ] Create a SERIALIZED inventory item, add 3 units with serial numbers
- [ ] Create a BULK inventory item (cables), set quantity 50
- [ ] Flag one serialized unit for repair → verify `IN_REPAIR` status
- [ ] Create a client
- [ ] Create a project, add both inventory items, verify availability check
- [ ] Create a crew member with Regular and OT rates
- [ ] Assign crew to project, log 10h shift → verify OT split (8h regular + 2h OT)
- [ ] Generate PDF invoice from project → download and inspect
- [ ] View inventory utilization report for the period
- [ ] Record payment → verify invoice status updates to `PAID`
