# Event Rental Manager — Requirements & Progress Tracker

> **Last updated:** 2026-05-30  
> **Branch:** main  
> **Overall status:** Phases 1–7 feature-complete; Phase 8–11 pending

---

## How to use this document

- Each requirement has an **FR code** (Functional Requirement) and a **status badge**
- Test requirements are listed under each FR — they must pass before the FR is marked ✅
- Phase completion = all FRs in phase are ✅ AND all listed tests pass

Status legend: `✅ Done` · `🔶 Partial` · `❌ Missing`

---

## Phase 1 — Foundation

**Goal:** Auth, DB schema, navigation shell, user management, deploy-ready skeleton.

| FR | Requirement | Status | Tests Required |
|----|-------------|--------|----------------|
| FR-01.1 | Email + password login with bcrypt | ✅ Done | `auth: login with valid credentials succeeds` |
| FR-01.2 | Session guard on all `/dashboard` routes | ✅ Done | `auth: unauthenticated request to /dashboard redirects to /login` |
| FR-01.3 | Role enum: `ADMIN`, `MANAGER`, `STAFF`, `VIEWER` | ✅ Done | `auth: role is attached to session` |
| FR-01.4 | Full Prisma schema with all entities | ✅ Done | `db: seed runs without error` |
| FR-01.5 | Sidebar navigation (all modules linked) | ✅ Done | — |
| FR-01.6 | User management UI (ADMIN: create, update, deactivate users) | ❌ Missing | `users: admin can create a new user; non-admin cannot access /users` |
| FR-01.7 | Seeded admin account | ✅ Done | `auth: seed admin can log in` |

**Phase 1 gaps:**
- No `/users` or `/team` route exists. The Prisma `User` model is present but there is no UI to create or manage users beyond the seeded admin. An ADMIN currently cannot invite teammates through the app.

---

## Phase 2 — Inventory

**Goal:** Categories, items (serialized + bulk), serialized unit management, maintenance.

| FR | Requirement | Status | Tests Required |
|----|-------------|--------|----------------|
| FR-02.1 | Inventory categories CRUD | ✅ Done | `inventory: category cannot be deleted when it has items` |
| FR-02.2 | Sub-categories CRUD | ✅ Done | — |
| FR-02.3 | Create/edit SERIALIZED inventory item | ✅ Done | `inventory: SERIALIZED item requires serial tracking` |
| FR-02.4 | Create/edit BULK inventory item | ✅ Done | `inventory: BULK item requires totalQuantity > 0` |
| FR-02.5 | Add serialized units (serial number, asset tag, status) | ✅ Done | — |
| FR-02.6 | Daily/weekly rental rate defaults per item | ✅ Done | — |
| FR-02.7 | Availability check over date range (SERIALIZED) | ✅ Done | `availability: serialized — count excludes IN_REPAIR and allocated units` |
| FR-02.8 | Availability check over date range (BULK) | ✅ Done | `availability: bulk — count deducts overlapping allocations` |
| FR-02.9 | excludeProjectId in availability (for edit flows) | ✅ Done | `availability: edit — current project's allocations not subtracted` |
| FR-02.10 | Search + filter inventory by category / status / availability | ✅ Done | — |
| FR-02.11 | Archive item (soft-delete via isActive) | ✅ Done | — |
| FR-02.12 | Hard delete item | ❌ Missing | — |
| FR-03.1 | Create maintenance log against item or serialized unit | ✅ Done | `maintenance: creating log auto-sets unit status to IN_REPAIR` |
| FR-03.2 | Maintenance status flow: Open → In Progress → Completed | ✅ Done | `maintenance: completing log sets unit back to AVAILABLE` |
| FR-03.3 | Track vendor, technician, cost per log | ✅ Done | — |
| FR-03.4 | Global maintenance queue with status/category filters | ✅ Done | — |
| FR-03.5 | Service history per item / unit | ✅ Done | — |

---

## Phase 3 — Clients & Projects

**Goal:** Client records, project lifecycle, kit list, sub-rentals, P&L view.

| FR | Requirement | Status | Tests Required |
|----|-------------|--------|----------------|
| FR-04.1 | Client CRUD (name, contact, email, phone, address, tax ID) | 🔶 Partial | `clients: create with all fields; update changes persist` |
| FR-04.2 | Delete client (with safeguard if has projects) | ❌ Missing | `clients: delete blocked when active projects exist` |
| FR-04.3 | Client history: linked projects and invoices | ✅ Done | — |
| FR-05.1 | Project types: SINGLE_EVENT, MULTI_DAY_TOUR, LONG_TERM_RENTAL | ✅ Done | — |
| FR-05.2 | Project status flow: Inquiry → Quoted → Confirmed → In Progress → Completed → Cancelled | ✅ Done | `projects: status can only advance through valid transitions` |
| FR-05.3 | Load-in / Start / End / Load-out date tracking | ✅ Done | `projects: loadOutAt must be >= endAt >= startAt >= loadInAt` |
| FR-05.4 | Equipment kit list (add line items with availability validation) | ✅ Done | `projects: adding equipment over available qty is rejected` |
| FR-05.5 | Allocate specific serialized units to kit list items | 🔶 Partial | `projects: allocated unit IDs are stored and excluded from future availability` |
| FR-05.6 | Sub-rental tracking (gear from external vendors) | ✅ Done | — |
| FR-05.7 | Sub-rental status: Requested → Confirmed → Received → Returned | ✅ Done | — |
| FR-05.8 | Project expenses (fuel, accommodation, misc) | ✅ Done | — |
| FR-05.9 | Project P&L view (equipment rev, sub-rental cost, labor, gross margin) | ✅ Done | `projects: P&L sum matches individual line items` |
| FR-05.10 | Delete project (with safeguard if has invoices) | ❌ Missing | `projects: delete blocked when confirmed invoices exist` |

**Phase 3 gaps:**
- `FR-04.2` / `FR-05.10`: Delete actions exist for neither clients nor projects. Currently, cancellation or archiving is the only path. A soft-delete or guarded hard-delete is needed.
- `FR-05.5`: The `updateEquipmentAllocation` server action exists but there is no UI surface that lets the user pick and assign specific serialized unit IDs to a kit list line item.

---

## Phase 4 — Crew & Time Tracking

**Goal:** Crew roster, rate tiers, assignments, timesheets with OT calculation, crew expenses.

| FR | Requirement | Status | Tests Required |
|----|-------------|--------|----------------|
| FR-06.1 | Crew roster CRUD (employee / freelancer) | 🔶 Partial | `crew: create with emergency contact and tax ID` |
| FR-06.2 | Delete crew member (soft-delete or guarded) | ❌ Missing | `crew: deactivated member cannot be assigned to future projects` |
| FR-06.3 | Rate tiers: Regular, Overtime, Double-Time, Travel Day, Per Diem | ✅ Done | — |
| FR-06.4 | Rate effective dates (history preserved) | ✅ Done | `crew: rate snapshot uses rate active at timesheet clock-in date` |
| FR-06.5 | Crew availability conflict checking on assignment | ✅ Done | `crew: overlapping assignments for same crew member are rejected` |
| FR-07.1 | Manual timesheet entry (clock-in, clock-out, break minutes) | ✅ Done | — |
| FR-07.2 | Time types: Work, Travel, Per Diem | ✅ Done | — |
| FR-07.3 | OT calculation: daily split (Regular / OT / DT) | ✅ Done | `payroll: 8h shift → 8h regular, 0 OT` |
| FR-07.4 | OT calculation: weekly threshold (40h rollover) | ✅ Done | `payroll: 6×8h week → first 40h regular, last 8h OT` |
| FR-07.5 | Double-time calculation at 12h daily threshold | ✅ Done | `payroll: 14h shift → 8h regular, 4h OT, 2h DT` |
| FR-07.6 | Configurable OT thresholds per system settings | ✅ Done | `payroll: custom policy 6h/10h/32h applied correctly` |
| FR-07.7 | Rate snapshot on timesheet approval | ✅ Done | `payroll: changing rate after approval does not change approved total` |
| FR-07.8 | Timesheet workflow: Draft → Submitted → Approved / Rejected | ✅ Done | `timesheets: only SUBMITTED sheets can be approved` |
| FR-07.9 | Crew expense submissions (amount, description, receipt) | ✅ Done (actions only) | — |
| FR-07.10 | Crew expense approval workflow (PENDING → APPROVED → REIMBURSED) | ✅ Done (actions only) | `expenses: PENDING → APPROVED → REIMBURSED flow works` |
| FR-07.11 | Crew expenses UI (view, create, approve on crew detail page) | ❌ Missing | — |

**Phase 4 gaps:**
- `FR-07.11`: Server actions and queries for crew expenses are complete, but the crew detail page has no Expenses tab. There is nowhere in the UI to create, view, or approve crew expenses.

---

## Phase 5 — Invoicing

**Goal:** Invoice creation from projects, line editing, PDF generation, payment tracking.

| FR | Requirement | Status | Tests Required |
|----|-------------|--------|----------------|
| FR-09.1 | Generate invoice from project (auto-populate from kit list) | ✅ Done | `invoices: line items match project kit list rates` |
| FR-09.2 | Invoice types: Deposit, Standard, Final | ✅ Done | — |
| FR-09.3 | Manual line item add/edit/remove | ✅ Done | — |
| FR-09.4 | Tax rate per invoice | ✅ Done | `invoices: tax computed on subtotal only` |
| FR-09.5 | Flat or percentage discount | ✅ Done | `invoices: percentage discount reduces subtotal before tax` |
| FR-09.6 | Invoice status: Draft → Sent → Partially Paid → Paid → Overdue → Void | ✅ Done | `invoices: status auto-upgrades to PARTIALLY_PAID on first payment` |
| FR-09.7 | Partial payment recording | ✅ Done | `invoices: two partial payments summing to total → status becomes PAID` |
| FR-09.8 | PDF invoice generation (server-side) | ✅ Done | `invoices: GET /api/pdf/invoice/[id] returns Content-Type: application/pdf` |
| FR-09.9 | Multi-currency invoices | ✅ Done | — |
| FR-09.10 | Delete invoice (or void with safeguard) | 🔶 Partial | `invoices: void blocks further payments` |

---

## Phase 6 — Reporting & Dashboard

**Goal:** Inventory utilization, revenue, labor reports; dashboard KPIs.

| FR | Requirement | Status | Tests Required |
|----|-------------|--------|----------------|
| FR-10.1 | Inventory utilization report (booked days vs available, revenue) | ✅ Done | `reports: utilization % = bookedDays / availableDays` |
| FR-10.2 | Revenue report (by project / client / month, gross margin) | ✅ Done | `reports: revenue sums match invoice totals for period` |
| FR-10.3 | Crew labor summary (hours + cost per member per project, OT breakdown) | ✅ Done | — |
| FR-10.4 | PDF export for reports | ❌ Missing | `reports: GET /api/pdf/report?type=revenue returns PDF` |
| FR-10.5 | Dashboard KPIs (active projects, open invoices, maintenance alerts, etc.) | ✅ Done | — |
| FR-10.6 | Date range filters on all reports | ✅ Done | — |

---

## Phase 7 — Polish

**Goal:** Error handling, loading states, security hardening, responsive layout.

| FR | Requirement | Status | Tests Required |
|----|-------------|--------|----------------|
| FR-11.1 | Error boundary on dashboard routes | ✅ Done | — |
| FR-11.2 | Loading skeleton for data tables | 🔶 Partial | — |
| FR-11.3 | Form submission pending states | ✅ Done | — |
| FR-11.4 | Toast notifications on success / error | ✅ Done | — |
| FR-11.5 | Try-catch wrapping all Prisma calls in server actions | ❌ Missing | `actions: DB constraint error returns { error: string } not a thrown exception` |
| FR-11.6 | Full date ordering validation in project schema | ❌ Missing | `schema: loadOutAt < endAt is rejected` |
| FR-11.7 | clockOut > clockIn validation in timesheet schema | ❌ Missing | `schema: clockOut before clockIn is rejected` |
| FR-11.8 | Responsive layout (mobile usable) | 🔶 Partial | — |

---

## Phase 8 — Test Infrastructure ✅ COMPLETE

**Result:** 102 tests pass, 2 todos (for validations not yet implemented). Coverage: 87% statements, 89% lines, all above threshold.

### 8A — Test Framework Setup ✅

- [x] Install **Vitest** + `@vitest/coverage-v8`
- [x] Configure `vitest.config.ts` with native tsconfig path resolution
- [x] Add `test`, `test:watch`, `test:coverage` scripts to `package.json`
- [x] Coverage thresholds: 80% lines/functions for `src/lib/` + `src/schemas/`

### 8B — Unit Tests: Payroll Engine ✅ (`src/lib/__tests__/payroll.test.ts`)

- [x] `calculateShiftOT: 8h shift → 8h regular, 0 OT, 0 DT`
- [x] `calculateShiftOT: 10h shift → 8h regular, 2h OT, 0 DT`
- [x] `calculateShiftOT: 14h shift → 8h regular, 4h OT, 2h DT`
- [x] `calculateShiftOT: 12h shift (exactly at DT threshold) → 8h regular, 4h OT, 0 DT`
- [x] `calculateShiftOT: 0h shift → all zeros`
- [x] `calculateShiftOT: break longer than shift → clamped to 0`
- [x] `calculateShiftOT: break minutes reduce billable hours`
- [x] `calculateShiftOT: weeklyRegularHoursUsed=36 + 8h → 4h regular, 4h OT`
- [x] `calculateShiftOT: weeklyRegularHoursUsed=40 + 8h → 0 regular, 8h OT`
- [x] `calculateShiftOT: weeklyUsed > threshold → 0 remaining regular`
- [x] `calculateShiftOT: custom policy (6h/10h/32h) applied correctly`
- [x] `calculateWeeklyOT: 5×8h week → all regular, no OT`
- [x] `calculateWeeklyOT: 6×8h week → first 5 regular, 6th fully OT`
- [x] `calculateWeeklyOT: entries sorted by clockIn regardless of input order`
- [x] `calculateWeeklyOT: returns Map keyed by entry.id`
- [x] `calculateWeeklyOT: weekly threshold split mid-week`
- [x] `calculateShiftTotal: correct cent-level arithmetic (3 variants)`
- [x] `calculateShiftTotal: rounds to nearest cent`

### 8C — Unit Tests: Availability Engine ✅ (`src/lib/__tests__/availability.test.ts`)

- [x] `SERIALIZED: AVAILABLE unit, no allocations → 1`
- [x] `SERIALIZED: IN_REPAIR unit → not counted`
- [x] `SERIALIZED: RETIRED unit → not counted`
- [x] `SERIALIZED: allocated unit → not counted`
- [x] `SERIALIZED: 3 units, 1 allocated, 1 IN_REPAIR → 1`
- [x] `SERIALIZED: inactive item → 0`
- [x] `SERIALIZED: item not found → 0`
- [x] `SERIALIZED: excludeProjectId forwarded to allocation query`
- [x] `BULK: totalQuantity=50, no allocations → 50`
- [x] `BULK: totalQuantity=50, allocated=30 → 20`
- [x] `BULK: totalQuantity=50, allocated=50 → 0`
- [x] `BULK: over-allocated → clamped to 0`
- [x] `BULK: excludeProjectId forwarded to line-item query`
- [x] `isSerializedUnitAvailable: AVAILABLE + no allocation → true`
- [x] `isSerializedUnitAvailable: IN_REPAIR → false`
- [x] `isSerializedUnitAvailable: RETIRED → false`
- [x] `isSerializedUnitAvailable: existing allocation → false`
- [x] `isSerializedUnitAvailable: unit not found → false`

### 8D — Unit Tests: Currency Module ✅ (`src/lib/__tests__/currency.test.ts`)

- [x] `getCurrency: valid code returns object with exponent`
- [x] `getCurrency: unknown code throws`
- [x] `toDinero / fromDinero: round-trip integer, zero, large amount`
- [x] `formatMoney: USD 1250 → "$12.50"; null/undefined → "—"`
- [x] `addAmounts: 100 + 200 = 300`
- [x] `subtractAmounts: 500 - 200 = 300`
- [x] `multiplyAmount: 100 × 3 = 300`
- [x] `convertCurrency: same currency → unchanged; USD→EUR at 0.85`
- [x] `parseDecimalToAmount: "12.50" → 1250; throws on invalid`

### 8E — Integration Tests: Server Actions (with test DB)

Deferred — requires a test database. Set up separately when CI environment is configured.

- [ ] `inventory: createMaintenanceLog sets unit status to IN_REPAIR`
- [ ] `inventory: completing maintenance sets unit back to AVAILABLE`
- [ ] `projects: addEquipmentItem rejects quantity exceeding availability`
- [ ] `crew: approveTimesheet calculates OT and snapshots rate`
- [ ] `crew: approveTimesheet on already-APPROVED sheet is rejected`
- [ ] `invoices: addPayment summing to total sets status to PAID`
- [ ] `invoices: addPayment exceeding total is rejected`

### 8F — Schema Validation Tests ✅ (`src/schemas/__tests__/schemas.test.ts`)

- [x] `projectSchema: rejects endAt < startAt`
- [x] `projectSchema: allows endAt === startAt`
- [x] `projectSchema: rejects missing name / clientId / invalid type`
- [x] `projectSchema: taxRate 0–1 range enforced`
- [x] `timesheetSchema: valid entry passes`
- [x] `timesheetSchema: rejects empty crewMemberId, negative breaks, invalid timeType`
- [x] `timesheetSchema: TODO — clockOut <= clockIn (FR-11.7, not yet implemented)`
- [x] `crewRateSchema: valid / invalid rateType / missing effectiveFrom`
- [x] `inventoryItemSchema: SERIALIZED and BULK valid; rejects empty name, invalid mode, negative rate`
- [x] `inventoryItemSchema: TODO — BULK totalQuantity=0 (FR-10B, not yet implemented)`
- [x] `clientSchema: valid / empty name / invalid email / empty email allowed`
- [x] `invoiceSchema: valid / no line items / taxRate > 1 / zero quantity`
- [x] `paymentSchema: valid / zero amount / negative / invalid method`

---

## Phase 9 — UX Completions ✅ COMPLETE

**Goal:** Close UI gaps identified in audit. All features have existing backend; this phase is frontend only.

### 9A — User Management (`/users`) ✅

- [x] `/users` page listing all users (ADMIN-only redirect guard)
- [x] Create user form (name, email, password, role)
- [x] Edit user (name, role, active toggle)
- [x] Reset password dialog
- [x] "Team" link added to sidebar

### 9B — Crew Expenses UI ✅

- [x] **Expenses** tab added to crew detail page (`/crew/[id]`)
- [x] Table with date, description, amount, status badge
- [x] Create expense dialog (description, amount, currency, date, notes)
- [x] Approve / Reject buttons on PENDING expenses
- [x] "Mark reimbursed" button on APPROVED expenses
- [x] Badge colors: PENDING=amber, APPROVED=blue, REIMBURSED=green, REJECTED=red

### 9C — Serialized Unit Allocation UI ✅

- [x] "Assign" button on SERIALIZED kit list rows (shows assigned serial numbers if set)
- [x] Dialog lazy-loads available units via `fetchSerializedUnitsForKitItem` server action
- [x] Shows unit serial number, asset tag, status badge (Assigned/Available/Unavailable)
- [x] Checkbox multi-select; unavailable units (conflicting or IN_REPAIR) are disabled
- [x] Saves via `updateEquipmentAllocation` action
- [x] New "Units" column in kit list table

### 9D — Delete Workflows ✅

- [x] `deleteClient` action — blocked if client has active (non-cancelled/completed) projects
- [x] `DeleteClientButton` component with AlertDialog confirm on client detail page
- [x] `deleteProject` action — only INQUIRY status, blocked if has invoices
- [x] Delete button on project detail header (only visible when status=INQUIRY)

---

## Phase 10 — Robustness ✅ COMPLETE

**Goal:** Eliminate silent failures, harden validation, add missing DB indexes.

### 10A — Server Action Error Handling

Every server action Prisma call must be wrapped in try/catch returning `{ error: string }`:

- [ ] `src/server/actions/clients.ts` — wrap all `prisma.*` calls
- [ ] `src/server/actions/crew.ts` — wrap all `prisma.*` calls  
- [ ] `src/server/actions/inventory.ts` — wrap all `prisma.*` calls
- [ ] `src/server/actions/invoices.ts` — wrap all `prisma.*` calls
- [ ] `src/server/actions/projects.ts` — wrap all `prisma.*` calls
- [ ] `src/server/actions/settings.ts` — wrap all `prisma.*` calls

### 10B — Schema Validation Improvements

- [ ] `projectSchema`: enforce `loadInAt ≤ startAt ≤ endAt ≤ loadOutAt` chain
- [ ] `timesheetSchema`: enforce `clockOut > clockIn`; enforce `breakMinutes < totalShiftMinutes`
- [ ] `inventorySchema`: enforce `totalQuantity > 0` for BULK mode
- [ ] `crew.ts` rates: enforce `amount > 0` on rate tiers

### 10C — Database Improvements

- [ ] Add composite index `(inventoryItemId, startAt, endAt)` on `ProjectEquipmentAllocation` for availability queries
- [ ] Add unique constraint on `User.email`
- [ ] Add index on `Project.startAt` and `Project.endAt` for date-range queries
- [ ] Migration: `prisma migrate dev --name improve_indexes`

### 10D — Minor Quality Fixes

- [ ] Remove `as any` cast in `src/lib/auth.ts` (use proper PrismaAdapter type)
- [ ] Replace non-null assertions in `unit-form.tsx` with safe access
- [ ] Remove stray `console.error` in production error boundary

---

## Phase 11 — PDF Reports ✅ COMPLETE

**Goal:** Add server-side PDF export for all three report types.

| Task | Status |
|------|--------|
| `/dashboard/reports/print?type=revenue&from=&to=` print page | ✅ Done |
| `/dashboard/reports/print?type=utilization&from=&to=` print page | ✅ Done |
| `/dashboard/reports/print?type=labor&from=&to=` print page | ✅ Done |
| PDF template: Revenue (KPIs + by-client summary + invoice detail table) | ✅ Done |
| PDF template: Utilization (KPIs + progress bars + item table) | ✅ Done |
| PDF template: Labor (KPIs + by-crew summary + timesheet detail table) | ✅ Done |
| "Export PDF" link on reports page (opens print page in new tab) | ✅ Done |

---

---

## Phase 12 — Project Operations ✅ COMPLETE

**Goal:** Full project scheduling and crew operations — phases, crew on project, labor subcontracts, live availability alerts, multi-warehouse inventory.

### 12A — Project Phases ✅
- [x] `ProjectPhase` model (PhaseType enum: PACKING/LOAD_IN/SETUP/SHOW/STRIKE/LOAD_OUT/TRAVEL/CUSTOM)
- [x] CUSTOM phase type requires a `customLabel` (validated in schema)
- [x] Schedule tab on project detail — table with phase name, datetime range, crew count
- [x] Add phase dialog with type picker + conditional custom label input
- [x] Delete phase with AlertDialog; crew assignments unlinked (not deleted) via SetNull FK

### 12B — Crew Management on Project ✅
- [x] `CrewAssignment.phaseId` FK added (optional, SetNull on phase delete)
- [x] Crew tab on project detail — table: name, role, phase badge, dates, remove
- [x] Assign crew dialog: crew Select, optional phase Select, role, date range
- [x] **Inline conflict warning** — 400ms debounce on crew member + date fields → `checkCrewMemberConflict` server action → amber advisory banner (server still enforces hard block)
- [x] `checkCrewMemberConflict` exported from `src/server/actions/crew.ts`

### 12C — Labor Subcontracts ✅
- [x] `LaborSubcontract` model (vendor, role, quantity, daily rate, status, optional phase link)
- [x] `LaborSubcontractStatus` enum: REQUESTED → CONFIRMED → RECEIVED → COMPLETED + CANCELLED
- [x] Labor tab on project detail — card per vendor, status dropdown, estimated cost (rate × qty × days)
- [x] Labor subcontract costs included in P&L (`laborSubcontractCosts` in `computeProjectPnL`)
- [x] Actions in `src/server/actions/labor.ts` (create, updateStatus, delete)

### 12D — Live Availability Alerts ✅
- [x] `checkItemAvailability(inventoryItemId, projectId)` server action in `projects.ts`
- [x] `useEffect` on `watchedItemId` in `KitListClient` — 300ms debounce, calls action
- [x] Inline colored text below Qty field: green (≥3), amber (1–2), red (0)
- [x] Loading state: "Checking availability…" while fetching

### 12E — Multiple Warehouses ✅
- [x] `Warehouse` model (name, address, city, country, isActive)
- [x] `InventoryItemWarehouseStock` model for per-warehouse BULK qty tracking
- [x] `SerializedUnit.warehouseId` FK (optional)
- [x] `upsertWarehouseStock` atomically updates stock row + recomputes `InventoryItem.totalQuantity`
- [x] `getAvailableQuantity` in `src/lib/availability.ts` **unchanged** (uses global `totalQuantity`)
- [x] `/dashboard/warehouses` page with CRUD, unit count, activate/deactivate
- [x] Sidebar "Warehouses" link after Inventory
- [x] Serialized unit form gains optional Warehouse Select

---

## Phase 13 — Inventory Enrichment ✅ COMPLETE

**Goal:** Rich inventory items with photos, free-form descriptions, and dynamic searchable properties.

### 13A — Item Photos

**DB changes:**
```prisma
model InventoryItemImage {
  id              String        @id @default(cuid())
  inventoryItemId String
  url             String        // Vercel Blob / S3 URL or relative path
  caption         String?
  sortOrder       Int           @default(0)
  isPrimary       Boolean       @default(false)
  createdAt       DateTime      @default(now())

  inventoryItem InventoryItem @relation(fields: [inventoryItemId], references: [id], onDelete: Cascade)
  @@index([inventoryItemId])
}
```
Add `images InventoryItemImage[]` relation to `InventoryItem`.

**Storage strategy:** Use Vercel Blob (`@vercel/blob`) for production; local `/public/uploads/` for dev. New API route `POST /api/upload/inventory-image` accepts `multipart/form-data`, returns `{ url }`. In dev, saves to disk. In prod, uploads to Blob store.

**UI tasks:**
- [ ] Image gallery on inventory item detail page (grid, primary image larger)
- [ ] Upload button opens file picker; shows preview before saving
- [ ] Drag-to-reorder images (or up/down buttons)
- [ ] Delete image with confirmation
- [ ] Primary image shown on inventory list as thumbnail
- [ ] `getItemById` query includes `images` ordered by `sortOrder`

**Server actions:** `addInventoryImage(itemId, url, caption)`, `deleteInventoryImage(imageId, itemId)`, `setPrimaryImage(imageId, itemId)`, `reorderImages(itemId, orderedIds)`

### 13B — Dynamic Item Properties

**Goal:** Flexible key-value attributes on inventory items for filtering and specs display (e.g. Power: 1200W, Weight: 23kg, IP-rated: true).

**DB changes:**
```prisma
model InventoryPropertyDef {
  id        String        @id @default(cuid())
  name      String        @unique   // e.g. "Power (W)", "Weight (kg)", "IP-rated"
  slug      String        @unique
  valueType PropertyValueType
  unit      String?       // display unit hint, e.g. "W", "kg", "dB"
  sortOrder Int           @default(0)
  createdAt DateTime      @default(now())

  values InventoryItemProperty[]
  @@index([valueType])
}

enum PropertyValueType {
  TEXT
  NUMERIC
  BOOLEAN
}

model InventoryItemProperty {
  id            String               @id @default(cuid())
  inventoryItemId String
  propertyDefId  String
  textValue      String?
  numericValue   Decimal?            @db.Decimal(15, 4)
  booleanValue   Boolean?

  inventoryItem InventoryItem        @relation(fields: [inventoryItemId], references: [id], onDelete: Cascade)
  propertyDef   InventoryPropertyDef @relation(fields: [propertyDefId], references: [id])

  @@unique([inventoryItemId, propertyDefId])
  @@index([inventoryItemId])
  @@index([propertyDefId])
}
```
Add `properties InventoryItemProperty[]` and `imageList InventoryItemImage[]` to `InventoryItem`.

**Property management UI:**
- [ ] Property definitions managed in Settings page (new "Item Properties" section) or Inventory → Categories page
- [ ] Create property def: name, type (TEXT/NUMERIC/BOOLEAN), optional unit
- [ ] On item detail page: "Properties" tab showing all defined properties with current values
- [ ] Inline edit each property value (toggle for BOOLEAN, number input for NUMERIC, text for TEXT)
- [ ] Inventory list filter: "Filter by property" — e.g. show all items where Power > 1000W

**Server actions:** `createPropertyDef`, `deletePropertyDef`, `upsertItemProperty(itemId, propertyDefId, value)`, `deleteItemProperty`

**Tests (new):**
- `propertySchema: NUMERIC rejects non-numeric value`
- `propertySchema: BOOLEAN must be true/false`
- `upsertItemProperty: updates existing, creates if absent`

---

## Phase 14 — CSV Import / Export ✅ COMPLETE

**Goal:** Bulk import and export inventory items and crew roster via CSV or Excel spreadsheet.

### 14A — Inventory CSV Export

- [ ] "Export CSV" button on `/dashboard/inventory` page
- [ ] API route `GET /api/export/inventory.csv` — returns RFC 4180 CSV
- [ ] Columns: refCode, name, category, subCategory, trackingMode, totalQuantity, dailyRateAmount, dailyRateCurrency, replacementCostAmount, isActive, serialNumbers (semicolon-joined for SERIALIZED)
- [ ] Date-stamped filename: `inventory-2026-06-01.csv`

### 14B — Inventory CSV Import

- [ ] "Import CSV" button on inventory page opens upload dialog
- [ ] API route `POST /api/import/inventory` — parses CSV, validates rows, upserts items
- [ ] Upsert logic: match on `refCode` if present, else create new
- [ ] Validation: required fields (name, category, trackingMode); numeric fields coerced; unknown categories → create or error (configurable)
- [ ] Result: `{ created: N, updated: N, errors: [{row, message}] }` shown in dialog
- [ ] CSV template download link

### 14C — Crew CSV Export

- [ ] "Export CSV" on `/dashboard/crew`
- [ ] API route `GET /api/export/crew.csv`
- [ ] Columns: refCode, firstName, lastName, email, phone, type, role, isActive, taxId

### 14D — Crew CSV Import

- [ ] API route `POST /api/import/crew` — upsert on email
- [ ] Validation: required firstName/lastName; valid type (EMPLOYEE/FREELANCER)
- [ ] Result summary same as inventory import

**Shared infrastructure:**
- `src/lib/csv.ts` — `parseCSV(text)`, `toCSV(rows, headers)` utilities using the `papaparse` package
- Import routes run in a transaction so partial failures roll back cleanly
- Max 500 rows per import (validate server-side)

---

## Phase 15 — LLM-Powered Item Details ✅ COMPLETE

**Goal:** Upload a photo or paste a description of a piece of equipment; the app calls an LLM with vision to suggest name, description, category, specs, and estimated replacement cost — pre-populating the item form for user review.

### 15A — Provider Abstraction Layer

New file `src/lib/ai.ts`:

```typescript
export type LLMProvider = "claude" | "openai" | "deepseek";

export interface ItemSuggestion {
  name: string;
  description: string;
  categoryHint: string;       // best-guess category name for matching
  dailyRateHint: number | null; // estimated cents
  replacementCostHint: number | null;
  properties: { name: string; value: string }[]; // suggested specs
}

export async function inferItemDetails(
  imageBase64: string,
  mimeType: string,
  textHint: string | undefined,
  provider: LLMProvider,
  apiKey: string
): Promise<ItemSuggestion>
```

**Per-provider implementation:**
- **Claude** — `@anthropic-ai/sdk`, model `claude-opus-4-8` (or configurable), vision via base64 image block. Prompt asks for structured JSON output.
- **OpenAI** — `openai` SDK, model `gpt-4o`, vision via `image_url` with base64 data URI.
- **DeepSeek** — OpenAI-compatible API (`baseURL: "https://api.deepseek.com"`), model `deepseek-chat` (text-only) or `deepseek-reasoner` — note DeepSeek does not currently support image input; falls back to text-only inference from the text hint.

**Prompt template (same across providers):**
```
You are an expert in professional AV, lighting, and staging equipment.
Given the image/description below, return ONLY valid JSON with this shape:
{ name, description, categoryHint, dailyRateHintCents, replacementCostHintCents, properties: [{name, value}] }
- name: short product name (brand + model if visible)
- description: 2-3 sentence technical description
- categoryHint: one of "Audio", "Lighting", "Video/LED", "Staging", "Other"
- dailyRateHintCents: integer cents, null if unknown
- replacementCostHintCents: integer cents, null if unknown
- properties: up to 8 key technical specs (e.g. [{name:"Power",value:"1200W"},{name:"Weight",value:"23kg"}])
```

### 15B — Settings: AI Configuration

New "AI / LLM" section on `/dashboard/settings` page:

- [ ] Provider Select: Claude / OpenAI / DeepSeek / None (disabled)
- [ ] API key input (masked, stored in `SystemSettings.aiProvider` + `SystemSettings.aiApiKey`)
- [ ] Optional: model override text field (defaults shown per provider)
- [ ] Test connection button — sends a minimal text request, shows "OK" or error

**DB changes:** Add to `SystemSettings`:
```prisma
aiProvider String? // "claude" | "openai" | "deepseek"
aiApiKey   String? // encrypted at rest (or env-var override)
aiModel    String? // optional model override
```

Migration: `add_ai_settings`

### 15C — Item Form: AI Fill Button

On the create/edit inventory item form (`src/components/inventory/item-form.tsx`):

- [ ] "AI fill" button (sparkle icon) next to the item name field — only shown when AI is configured in settings
- [ ] Clicking opens an "AI fill" dialog:
  - File picker for image (JPEG/PNG/WebP, max 5MB)
  - Optional text hint textarea ("e.g. 'Martin MAC Encore Performance, moving head wash'")
  - Provider badge showing which LLM is configured
  - "Analyze" button → POST to `/api/ai/fill-item`
- [ ] API route `POST /api/ai/fill-item`: receives image + hint, loads provider config from settings, calls `inferItemDetails`, returns `ItemSuggestion`
- [ ] On success: pre-populate form fields (name, description, categoryId matched by hint, dailyRateAmount, replacementCostAmount)
- [ ] Suggested properties shown as chips the user can click to add to the item's property list
- [ ] User reviews everything before saving — AI output is never auto-saved

**Tests:**
- `src/lib/__tests__/ai.test.ts` — mock provider calls, verify JSON parsing, verify fallback on malformed response
- Schema test: `ItemSuggestion` shape validation

### 15D — Upload Endpoint

New API route `POST /api/ai/fill-item`:
```typescript
// Accepts multipart/form-data: image (File), hint (string?), 
// Reads AI config from DB settings
// Returns ItemSuggestion JSON
// Max image size: 5MB
// Timeout: 30s
// Rate limit: 10 req/min per session (to avoid accidental API cost)
```

---

## Phase 17 — Duration-Based Pricing Curves ✅ COMPLETE

**Goal:** Longer rentals get a lower effective per-day/per-week price via reusable rate cards.

- [x] `PricingProfile` + `PricingTier` models (minDays → multiplier); nullable FKs on `InventoryItem` and `ProjectEquipmentItem`. Migration `add_pricing_profiles`.
- [x] Seeded built-in **Standard** profile (1→1.0, 2→1.8, 3→2.5, 7→3.0, 14→5.0, 30→9.0), `isDefault`+`isSystem`.
- [x] `src/lib/pricing.ts`: `curveMultiplier` (step-down), `computeLineTotal` (FLAT bypass, linear fallback for no profile), `resolveTiers` (line → item → default), `effectivePerDay`.
- [x] `/dashboard/pricing` management page (INVENTORY_PRICING:MANAGE) with tier editor + live effective-per-day preview; set default; guarded delete; sidebar "Pricing" link.
- [x] Pricing-profile select on inventory item form and on project kit-list add/edit dialog, with **live curve-based line-total preview**.
- [x] `computeProjectPnL` and kit-list totals use the curve; backward compatible (no profile = legacy linear math).
- [x] Invoice generation from a project (`buildInvoiceLinesFromProject`) pre-fills line items with curve totals; still editable.
- [x] All pricing actions permission-gated + audit-logged (ties into Phase 16).
- [x] Tests: `src/lib/__tests__/pricing.test.ts` (curve lookup, FLAT/linear, monotonicity at breakpoints, resolveTiers) + pricing schema validation cases.

---

## Phase 18 — Flexible Discount System ✅ COMPLETE

**Goal:** Negotiated discounts at line / category / project scope (percent or fixed), with a no-discount lock for consumables.

- [x] Schema (`add_discounts`): `discountPercent`/`discountFixed` on Project & ProjectEquipmentItem; `noDiscount` on InventoryItem; `defaultNoDiscount` on InventoryCategory; new `ProjectCategoryDiscount` join.
- [x] `src/lib/discounts.ts`: `computeLineDiscounts` — most-specific-wins (line → category → project), locks respected, fixed amounts distributed proportionally; `hasDiscount`.
- [x] Discounts feed `computeProjectPnL` (`equipmentDiscount`, `netEquipmentRevenue`) and `buildInvoiceLinesFromProject` (sets invoice `discountAmount` from gross lines).
- [x] Setting any discount value requires `INVENTORY_PRICING:MANAGE` (mirrors price-change guard); audit-logged. New `setProjectDiscount` / `setCategoryDiscount` actions.
- [x] New items inherit category `defaultNoDiscount`.
- [x] UI: line discount control + live gross/discount/net preview in kit dialog; net display + footer in kit table; `DiscountsClient` panel for project + per-category discounts; P&L "Equipment discount" line; `noDiscount` checkbox on item form; `defaultNoDiscount` checkbox on category manager.
- [x] Backward compatible: no discounts → totals unchanged.
- [x] Tests: `src/lib/__tests__/discounts.test.ts` (per-line %/fixed, most-specific-wins, lock, proportional fixed distribution, mixed levels, total reconciliation) + equipment discount schema validation. **210 tests total.**

---

## Backlog / Future Consideration

| Item | Notes |
|------|-------|
| Email notifications | Send invoice PDF via email on status → SENT |
| Payment gateway integration | Stripe for deposit collection |
| Accounting export | QuickBooks / Xero CSV export |
| Mobile app / PWA | Currently web-only |
| Calendar view | Drag-and-drop project scheduling with phase blocks |
| Equipment QR codes | Scan to view/update unit status (links to item detail) |
| Multi-tenant / multi-org | Currently single-organization |
| Rate limiting on server actions | Prevent abuse on public-facing endpoints |
| Audit log | Record who changed what and when |
| Barcode scanning | Scan asset tags to assign serialized units to projects |

---

## Phase Completion Summary

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Foundation, Auth, DB, Navigation | ✅ Complete (user mgmt added in Phase 9) |
| 2 | Inventory + Maintenance | ✅ Complete |
| 3 | Clients + Projects | ✅ Complete (delete + allocation added in Phase 9) |
| 4 | Crew + Timesheets + Expenses | ✅ Complete (expenses UI added in Phase 9) |
| 5 | Invoicing + PDF | ✅ Complete |
| 6 | Reporting + Dashboard | ✅ Complete (PDF export added in Phase 11) |
| 7 | Polish + Error Handling | ✅ Complete (neverthrow + validation in Phase 10) |
| 8 | Test Infrastructure | ✅ Complete (now 210 tests across 10 files) |
| 9 | UX Completions | ✅ Complete |
| 10 | Robustness | ✅ Complete |
| 11 | PDF Reports | ✅ Complete |
| **12** | **Project Operations** | **✅ Complete** (phases, crew, labor, availability, warehouses) |
| **13** | **Inventory Enrichment** | **✅ Complete** (photos + dynamic properties) |
| **14** | **CSV Import / Export** | **✅ Complete** (inventory + crew) |
| **15** | **LLM-Powered Item Details** | **✅ Complete** (Claude / OpenAI / DeepSeek) |
| **16** | **Governance & Audit Trail** | **✅ Complete** |
| **17** | **Duration-Based Pricing Curves** | **✅ Complete** (rate cards, profiles, invoice prefill) |
| **18** | **Flexible Discount System** | **✅ Complete** (line/category/project + consumable lock) |
