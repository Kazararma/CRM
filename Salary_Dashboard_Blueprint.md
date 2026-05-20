# Salary Dashboard Module — Developer Blueprint
### Wavelet CRM · React 18 + Vite + Tailwind CSS + Lucide React + Firebase Firestore

> **Scope of this document:** This blueprint covers exclusively the Salary Dashboard module. The Floating Shift Timer, Work Log submission, and base Financial Hooks are assumed complete and operational. This document defines everything that must be built on top of that infrastructure: Firestore schema additions, the salary computation engine, the Admin and Worker view hierarchies, and the full Payment Handshake transaction flow.

---

## Table of Contents
1. [Module Overview & Constraints](#1-module-overview--constraints)
2. [Firestore Schema — New & Extended Structures](#2-firestore-schema--new--extended-structures)
3. [Salary Computation Engine](#3-salary-computation-engine)
4. [Admin View Architecture](#4-admin-view-architecture)
5. [Worker View Architecture](#5-worker-view-architecture)
6. [Payment Handshake Logic](#6-payment-handshake-logic)
7. [State Management & Hook Design](#7-state-management--hook-design)
8. [Component Tree Reference](#8-component-tree-reference)
9. [Security Rules Additions](#9-security-rules-additions)

---

## 1. Module Overview & Constraints

### 1.1 Purpose
The Salary Dashboard is a dedicated top-level section (`/salary`) that consolidates all payroll tracking, salary configuration, and payment confirmation into one module. It replaces salary-setting functionality previously housed in the People section.

### 1.2 Role Bifurcation
The module renders one of two completely separate view hierarchies based on `currentUser.role`:

```
/salary
  ├── currentUser.role === 'admin'   → <SalaryAdminView />
  └── currentUser.role === 'worker'  → <SalaryWorkerView />
```

Roles available in the existing system: `"super_admin"`, `"admin"`, `"worker"`. Both `super_admin` and `admin` render the Admin View. Workers render the Worker View. Apply this check at the top-level page component — never inside child components.

### 1.3 Currency Formatting Rule
Every monetary value rendered anywhere in this module must pass through a single shared utility:

```js
// src/utils/formatCurrency.js
export const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
```

Do not inline-format any currency value in JSX. Import `formatINR` wherever a ₹ value is displayed.

### 1.4 Real-Time Requirement
All data in this module must be driven by Firestore `onSnapshot` listeners, not one-shot `getDocs` calls. Every listener must be registered in a `useEffect` and cleaned up via its returned unsubscribe function. Loading and error states must be handled on every listener before data is rendered.

### 1.5 Assumptions About Existing Infrastructure
The following are assumed complete and must be consumed, not rebuilt:
- `users/{userId}/shifts/{shiftId}` subcollection with fields: `date` (string `"YYYY-MM-DD"`), `startTime` (Timestamp), `endTime` (Timestamp), `durationMinutes` (number), `isValidated` (boolean), `projectId` (string), `status` ("completed" | "active" | "expired").
- `projects/{projectId}` documents with `assignedWorkers: string[]` array.
- `useValidatedShifts(userId, projectId?)` hook (or equivalent) already delivering validated shift data from Firestore.
- Auth Context exposing `currentUser.uid` and `currentUser.role`.

---

## 2. Firestore Schema — New & Extended Structures

> **Non-destructive rule:** No existing field in `users`, `projects`, or the `shifts` subcollection is removed or renamed. Every change below is additive.

---

### 2.1 Extended `users` Document — `salary` Config Map

Add a `salary` map field to each worker's user document. This is written exclusively by admins via `<SalaryConfigModal />` and read by both views.

```
users/{userId}
  └── salary: {
        type:          string      // "project" | "monthly" | "hourly"
                                   // This is the ONLY salary type active at one time.
        configuredBy:  string      // uid of admin who last wrote this config
        configuredAt:  Timestamp   // server timestamp of last configuration save
        isConfigured:  boolean     // false = admin has not set a salary yet

        // ── Active when type === "project" ─────────────────────────────────
        project: {
          projectId:             string     // Firestore ID of the project
          projectName:           string     // Denormalized — avoids extra fetch on render
          contractStartDate:     Timestamp  // Start of the agreed engagement
          contractEndDate:       Timestamp  // End of the agreed engagement (deadline)
          agreedBasePay:         number     // ₹ total for work within the time range
          overtimeRatePerHour:   number     // ₹/hr for validated hours beyond contractEndDate
        }

        // ── Active when type === "monthly" ─────────────────────────────────
        monthly: {
          fixedMonthlySalary:    number     // ₹ flat pay per qualifying month
          requiredWorkDays:      number     // Qualifying threshold — always 20
          requiredHoursPerDay:   number     // Admin-defined: 6 or 7 (validated: min 6, max 7)
        }

        // ── Active when type === "hourly" ──────────────────────────────────
        hourly: {
          ratePerHour:           number     // ₹/hr — applies to all assigned projects
          // Per-project hour totals are computed at read time from validated shifts.
          // Do NOT store per-project hour counts in this config — they will become stale.
        }
      }
```

---

### 2.2 New Top-Level Collection — `salary_transactions/{transactionId}`

This is the central schema addition for the Payment Handshake. Each document represents one payment event scoped to a worker, a payment period, and optionally a project.

```
salary_transactions/{transactionId}
  ├── transactionId:      string      // Auto-generated Firestore document ID
  │
  ├── // ── Parties ──────────────────────────────────────────────────────────
  ├── workerId:           string      // uid of the worker being paid
  ├── workerName:         string      // Denormalized for display
  ├── adminId:            string      // uid of admin who initiated payment
  ├── adminName:          string      // Denormalized for display
  │
  ├── // ── Payment Scope ─────────────────────────────────────────────────────
  ├── salaryType:         string      // "project" | "monthly" | "hourly"
  ├── scope: {
  │     projectId:        string | null   // null for monthly type
  │     projectName:      string | null   // null for monthly type
  │     periodMonth:      string | null   // "YYYY-MM" — for monthly type; null otherwise
  │     periodStart:      Timestamp | null
  │     periodEnd:        Timestamp | null
  │   }
  │
  ├── // ── Financial Snapshot ────────────────────────────────────────────────
  │   // A frozen snapshot of the computation at the moment admin clicked Pay.
  │   // This record is immutable after creation — it is a receipt.
  ├── amountPaid:         number      // ₹ total admin marked as paid
  ├── hoursLogged:        number      // Total validated hours covered by this payment
  ├── breakdown: {
  │     basePay:          number | null
  │     overtimeHours:    number | null
  │     overtimePay:      number | null
  │     daysWorked:       number | null
  │     hourlyRate:       number | null
  │   }
  │
  ├── // ── Handshake State Machine ────────────────────────────────────────────
  ├── status:             string
  │   //  "PENDING_CONFIRMATION"   → Admin paid; worker has not yet confirmed
  │   //  "PAID"                   → Worker confirmed receipt; case closed
  │   //  "DISPUTED"               → Worker clicked "Not Received"; admin must re-issue
  │
  ├── paidAt:             Timestamp       // Set when admin clicks Pay Salary (doc creation time)
  ├── confirmedAt:        Timestamp | null // Set when worker clicks Salary Received
  ├── disputedAt:         Timestamp | null // Set when worker clicks Not Received
  ├── disputeNote:        string | null    // Optional text from worker explaining the dispute
  ├── resolvedAt:         Timestamp | null // Set when a disputed case is re-issued and confirmed
  │
  └── isResolved:         boolean
      // true  = status is "PAID" (terminal, happy path)
      // false = status is "PENDING_CONFIRMATION" or "DISPUTED" (still active)
```

**Immutability rule:** Once created, a `salary_transactions` document is **never updated** by the admin. The admin's only write operation is creation. Workers write only the status-update fields (`status`, `confirmedAt`, `disputedAt`, `disputeNote`). If a worker disputes and the admin re-issues payment, a **new** `salary_transactions` document is created. The old disputed document has its `resolvedAt` field set.

**Indexing requirements** — add to `firestore.indexes.json`:
```json
[
  { "collectionGroup": "salary_transactions",
    "fields": [{"fieldPath": "workerId", "order": "ASCENDING"},
               {"fieldPath": "paidAt",   "order": "DESCENDING"}] },
  { "collectionGroup": "salary_transactions",
    "fields": [{"fieldPath": "status",   "order": "ASCENDING"},
               {"fieldPath": "paidAt",   "order": "DESCENDING"}] }
]
```

---

### 2.3 Schema Summary

```
users/{userId}
  └── .salary { type, configuredBy, configuredAt, isConfigured,
                project{}, monthly{}, hourly{} }   ← New map field

salary_transactions/{transactionId}                ← New top-level collection
  └── { workerId, adminId, salaryType, scope{},
         amountPaid, breakdown{}, status,
         paidAt, confirmedAt, disputedAt, isResolved }
```

---

## 3. Salary Computation Engine

Create `src/utils/salaryEngine.js`. All functions are **pure** — they accept pre-fetched data arrays and return computed values. Zero Firestore calls inside this file.

```js
// src/utils/salaryEngine.js

import { formatINR } from './formatCurrency';

/**
 * PROJECT-BASED SALARY
 * Calculates base pay and overtime for a worker on a specific project.
 *
 * @param {object} config   - user.salary.project (from Firestore)
 * @param {object[]} shifts - validated shifts for this worker on this project
 *                            Each shift: { durationMinutes, startTime (Timestamp), endTime }
 * @returns {{ withinRangeMinutes, overtimeMinutes, overtimeHours,
 *             basePay, overtimePay, totalPayable, formatted }}
 */
export function computeProjectSalary(config, shifts) {
  const contractEnd = config.contractEndDate.toDate();

  let withinRangeMinutes = 0;
  let overtimeMinutes = 0;

  shifts.forEach((shift) => {
    const shiftEnd = shift.endTime?.toDate() ?? new Date();
    if (shiftEnd <= contractEnd) {
      withinRangeMinutes += shift.durationMinutes;
    } else {
      // Shift partially or fully beyond contract end
      const shiftStart = shift.startTime.toDate();
      if (shiftStart >= contractEnd) {
        // Entire shift is overtime
        overtimeMinutes += shift.durationMinutes;
      } else {
        // Split: portion within range + portion as overtime
        const withinMs = contractEnd - shiftStart;
        const withinMins = withinMs / 60000;
        withinRangeMinutes += withinMins;
        overtimeMinutes += shift.durationMinutes - withinMins;
      }
    }
  });

  const overtimeHours = overtimeMinutes / 60;
  const basePay = config.agreedBasePay;
  const overtimePay = overtimeHours * config.overtimeRatePerHour;
  const totalPayable = basePay + overtimePay;

  return {
    withinRangeMinutes,
    overtimeMinutes,
    overtimeHours: parseFloat(overtimeHours.toFixed(2)),
    basePay,
    overtimePay: parseFloat(overtimePay.toFixed(2)),
    totalPayable: parseFloat(totalPayable.toFixed(2)),
    formatted: {
      basePay:      formatINR(basePay),
      overtimePay:  formatINR(overtimePay),
      totalPayable: formatINR(totalPayable),
    },
  };
}

/**
 * MONTHLY SALARY
 * Determines if the worker is eligible for payout this month.
 *
 * @param {object}   config - user.salary.monthly
 * @param {object[]} shifts - validated shifts in the target calendar month
 * @returns {{ daysWorked, qualifyingDays, isEligible, amountPayable, formatted }}
 */
export function computeMonthlySalary(config, shifts) {
  // Group shifts by date and sum durationMinutes per day
  const minutesByDate = {};
  shifts.forEach((s) => {
    minutesByDate[s.date] = (minutesByDate[s.date] ?? 0) + s.durationMinutes;
  });

  const requiredMinutes = config.requiredHoursPerDay * 60;
  const daysWorked = Object.keys(minutesByDate).length;
  const qualifyingDays = Object.values(minutesByDate)
    .filter((mins) => mins >= requiredMinutes).length;

  const isEligible = qualifyingDays >= config.requiredWorkDays;
  const amountPayable = isEligible ? config.fixedMonthlySalary : 0;

  return {
    daysWorked,
    qualifyingDays,
    isEligible,
    amountPayable,
    formatted: {
      amountPayable: formatINR(amountPayable),
      fixedSalary:   formatINR(config.fixedMonthlySalary),
    },
  };
}

/**
 * HOURLY SALARY
 * Computes per-project and grand-total compensation for an hourly worker.
 *
 * @param {object}   config - user.salary.hourly
 * @param {object[]} shifts - all validated shifts for the worker (any project)
 * @returns {{ projectBreakdown, grandTotalHours, grandTotalPayable, formatted }}
 */
export function computeHourlySalary(config, shifts) {
  // Group by projectId
  const byProject = {};
  shifts.forEach((s) => {
    if (!byProject[s.projectId]) {
      byProject[s.projectId] = {
        projectId:   s.projectId,
        projectName: s.projectName,
        totalMinutes: 0,
      };
    }
    byProject[s.projectId].totalMinutes += s.durationMinutes;
  });

  const projectBreakdown = Object.values(byProject).map((p) => {
    const totalHours = parseFloat((p.totalMinutes / 60).toFixed(2));
    const amountPayable = parseFloat((totalHours * config.ratePerHour).toFixed(2));
    return {
      ...p,
      totalHours,
      amountPayable,
      formatted: {
        totalHours:    `${totalHours} hrs`,
        amountPayable: formatINR(amountPayable),
      },
    };
  });

  const grandTotalHours = projectBreakdown.reduce((s, p) => s + p.totalHours, 0);
  const grandTotalPayable = projectBreakdown.reduce((s, p) => s + p.amountPayable, 0);

  return {
    projectBreakdown,
    grandTotalHours: parseFloat(grandTotalHours.toFixed(2)),
    grandTotalPayable: parseFloat(grandTotalPayable.toFixed(2)),
    formatted: {
      grandTotalPayable: formatINR(grandTotalPayable),
    },
  };
}
```

---

## 4. Admin View Architecture

### 4.1 Top-Level — `<SalaryAdminView />`
**File:** `src/pages/Salary/SalaryAdminView.jsx`

**Responsibilities:**
- Owns two `onSnapshot` subscriptions:
  1. `users` collection where `role === "worker"` → builds the worker roster.
  2. `salary_transactions` where `status !== "PAID"` → overlays live handshake state on cards.
- Derives the **Global Payroll Liability** from computed salaries across all worker cards.
- Renders `<GlobalPayrollTracker />` and a grid of `<AdminWorkerSalaryCard />` components.

**Data loading pattern:**
```js
// Both listeners run in parallel inside useEffect pairs.
// Worker data and transaction data are stored separately in state,
// then merged in a useMemo before passing to child components.

const mergedWorkerData = useMemo(() =>
  workers.map((w) => ({
    ...w,
    activeTransaction: transactions.find(
      (t) => t.workerId === w.id && !t.isResolved
    ) ?? null,
  })),
[workers, transactions]);
```

---

### 4.2 `<GlobalPayrollTracker />`
**File:** `src/components/salary/GlobalPayrollTracker.jsx`

A summary bar at the top of the Admin View.

**Displayed metrics:**
- **Total Workers on Payroll** — count of workers where `salary.isConfigured === true`.
- **Total Payroll Liability (₹)** — sum of all workers' `computedTotal` from the salary engine. This is a live computed value, not stored.
- **Pending Confirmations** — count of `salary_transactions` with `status === "PENDING_CONFIRMATION"`.
- **Disputed Payments** — count with `status === "DISPUTED"`. Rendered in red with a warning icon (`AlertTriangle` from Lucide).

**Props:**
```ts
interface GlobalPayrollTrackerProps {
  workers: MergedWorkerData[];
  transactions: SalaryTransaction[];
}
```

---

### 4.3 `<AdminWorkerSalaryCard />`
**File:** `src/components/salary/AdminWorkerSalaryCard.jsx`

The core UI unit of the Admin View. One card per worker.

**Props:**
```ts
interface AdminWorkerSalaryCardProps {
  worker: UserDocument;           // Full user doc including salary config
  validatedShifts: ShiftDoc[];    // Pre-fetched validated shifts for this worker
  activeTransaction: SalaryTransaction | null;
  onPaySalary: (worker: UserDocument, computedData: ComputedSalary) => void;
  onConfigureSalary: (worker: UserDocument) => void;
}
```

**Card Header — always shown:**
- Worker avatar (initials fallback), name, role badge.
- `<SalaryTypeBadge />` — a colored pill: `PROJECT` (blue), `MONTHLY` (purple), `HOURLY` (amber).
- If `salary.isConfigured === false`: render a prominent "Not Configured" state with only the `[Configure Salary]` button — no financial data shown.

**Card Body — conditional on `salary.type`:**

*Type: `"project"`*
```
┌─────────────────────────────────────────────┐
│ Project:      [projectName]                  │
│ Time Range:   [contractStartDate] → [contractEndDate] │
│ Time Used:    [withinRangeMinutes / 60] hrs  │
│ Overtime:     [overtimeHours] hrs  @ ₹[rate]/hr │
│ ─────────────────────────────────────────── │
│ Base Pay:     ₹[agreedBasePay]               │
│ Overtime Pay: ₹[overtimePay]  (amber if > 0)│
│ TOTAL DUE:    ₹[totalPayable]  (bold, large) │
└─────────────────────────────────────────────┘
```

*Type: `"monthly"`*
```
┌─────────────────────────────────────────────┐
│ Current Month:  [MMMM YYYY]                  │
│ Days Logged:    [qualifyingDays] / 20 days   │
│ Req. Hrs/Day:   [requiredHoursPerDay] hrs    │
│ Eligibility:    ✅ Eligible / ⏳ In Progress  │
│ ─────────────────────────────────────────── │
│ PAYOUT:  ₹[fixedMonthlySalary]  (if eligible)│
│          ₹0.00  (if not yet eligible)        │
└─────────────────────────────────────────────┘
```

*Type: `"hourly"`*
```
┌─────────────────────────────────────────────┐
│ Rate:  ₹[ratePerHour] / hr                  │
│ ─────────────────────────────────────────── │
│ Per-Project Breakdown:                       │
│  [projectName A]  [X.XX hrs]  ₹[amount]     │
│  [projectName B]  [X.XX hrs]  ₹[amount]     │
│ ─────────────────────────────────────────── │
│ TOTAL HOURS:   [grandTotalHours] hrs         │
│ TOTAL DUE:     ₹[grandTotalPayable]  (bold) │
└─────────────────────────────────────────────┘
```

**Card Footer — Action Buttons:**

The footer state depends entirely on `activeTransaction?.status`:

| `activeTransaction` state | Footer renders |
|--------------------------|----------------|
| `null` (no active tx) | `[Configure Salary]`  `[Pay Salary]` |
| `status: "PENDING_CONFIRMATION"` | Amber badge: "Awaiting Worker Confirmation" + `[Cancel Payment]` |
| `status: "DISPUTED"` | Red badge: "⚠ Worker Reported Not Received" + `[Re-issue Payment]` |
| `isResolved: true` | Green badge: "✓ Payment Confirmed" (read-only, fades after 5s) |

**`[Pay Salary]` click handler:**
```js
const handlePaySalary = () => {
  // 1. Compute the salary snapshot using the engine
  const computedData = computeSalaryForWorker(worker, validatedShifts);
  // 2. Open <PaySalaryConfirmModal /> passing computedData
  onPaySalary(worker, computedData);
};
```

---

### 4.4 `<SalaryConfigModal />`
**File:** `src/components/salary/SalaryConfigModal.jsx`

Opened when admin clicks `[Configure Salary]` on a worker card. Replaces the salary-setting UI that was previously in the People section.

**Structure:**
- Header: "Configure Salary — [Worker Name]"
- A tab/radio group for type selection: `Project-Based` | `Monthly` | `Hourly`
- Conditional form fields based on selected type:

*Project-Based fields:*
- Project selector (dropdown of `projects` where `assignedWorkers` contains this worker's uid)
- Contract Start Date (date picker)
- Contract End Date (date picker)
- Agreed Base Pay (₹ number input)
- Overtime Rate (₹/hr number input)

*Monthly fields:*
- Fixed Monthly Salary (₹ number input)
- Required Hours/Day (number input, min: 6, max: 7, step: 0.5)

*Hourly fields:*
- Rate Per Hour (₹ number input)

**On Save:** Writes the `salary` map to `users/{workerId}` using `updateDoc`. Sets `configuredBy`, `configuredAt: serverTimestamp()`, `isConfigured: true`.

---

### 4.5 `<PaySalaryConfirmModal />`
**File:** `src/components/salary/PaySalaryConfirmModal.jsx`

A confirmation dialog before writing the transaction.

**Displays:** A read-only summary of the payment about to be made — worker name, salary type, amount, period covered.

**On Confirm:** See Section 6 (Payment Handshake — Admin Initiates).

**On Cancel:** Dismisses with no Firestore writes.

---

## 5. Worker View Architecture

### 5.1 Top-Level — `<SalaryWorkerView />`
**File:** `src/pages/Salary/SalaryWorkerView.jsx`

**Responsibilities:**
- Owns two `onSnapshot` subscriptions:
  1. `users/{currentUser.uid}` — for the worker's own salary config.
  2. `salary_transactions` where `workerId === currentUser.uid` ordered by `paidAt DESC` — for transaction history and pending confirmations.
- Renders a personal salary summary and a transaction history list.

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  [PENDING PAYMENT BANNER — shown if tx is PENDING]   │
├──────────────────────────────────────────────────────┤
│  <WorkerSalaryBreakdown />   (current accrued pay)   │
├──────────────────────────────────────────────────────┤
│  <PaymentHistoryList />      (past transactions)     │
└──────────────────────────────────────────────────────┘
```

---

### 5.2 Pending Payment Banner — `<PendingPaymentBanner />`
**File:** `src/components/salary/PendingPaymentBanner.jsx`

Rendered **only** when `activeTransaction?.status === "PENDING_CONFIRMATION"`.

**Appearance:** A full-width green-tinted alert bar with a bell icon. Content:
```
🔔  [AdminName] has marked your salary of ₹[amountPaid] as paid.
    Please confirm receipt.

    [ ✓ Salary Received ]     [ ✗ Not Received ]
```

Both buttons are large and visually distinct. The banner is sticky at the top of the Worker View.

**`[Salary Received]` click:** Calls `handleSalaryReceived(transaction.id)`. See Section 6.

**`[Not Received]` click:** Opens `<DisputeModal />`.

---

### 5.3 `<DisputeModal />`
**File:** `src/components/salary/DisputeModal.jsx`

A minimal modal with:
- A short explanatory text: "Let us know what went wrong. Your admin will be notified."
- An optional textarea: "Describe the issue (optional)"
- `[Submit Report]` button → calls `handleDisputePayment(transaction.id, note)`. See Section 6.
- `[Cancel]` button → dismisses.

---

### 5.4 `<WorkerSalaryBreakdown />`
**File:** `src/components/salary/WorkerSalaryBreakdown.jsx`

Displays the worker's current accrued (unpaid) compensation. Content is a read-only version of the Admin card body, matched to their salary type. No configuration controls.

**Key difference from Admin card:** Only shows unpaid/unconfirmed amounts. Once a transaction is `PAID`, those hours should be visually marked as settled (greyed out or moved to history).

**Accrued hours tracking:** Hours in validated shifts that are NOT yet covered by a `PAID` or `PENDING_CONFIRMATION` transaction are "accrued unsettled". Compute this by subtracting the `hoursLogged` of all non-disputed resolved transactions from total validated hours.

---

### 5.5 `<PaymentHistoryList />`
**File:** `src/components/salary/PaymentHistoryList.jsx`

A chronological list of past `salary_transactions` for this worker.

**Each row shows:**
- Date paid (`paidAt` formatted as `DD MMM YYYY`)
- Salary type badge
- Amount: ₹ [amountPaid]
- Status chip:
  - `PAID` → green "Confirmed"
  - `DISPUTED` → red "Disputed"
  - `PENDING_CONFIRMATION` → amber "Awaiting Confirmation" (this should only appear in the Banner, but kept here as a fallback)
- An expand toggle to show the `breakdown` snapshot.

---

## 6. Payment Handshake Logic

This section is the authoritative specification for every Firestore write in the payment lifecycle. All writes use `serverTimestamp()` for time fields.

---

### 6.1 State Machine

```
                  ┌───────────────────────────────────────┐
                  │           No Active Transaction         │
                  └──────────────┬────────────────────────┘
                                 │ Admin clicks [Pay Salary]
                                 ▼
                  ┌───────────────────────────────────────┐
                  │       status: PENDING_CONFIRMATION      │  ← New doc created
                  │         isResolved: false               │
                  └──────────────┬──────────────┬─────────┘
                                 │              │
          Worker clicks          │              │  Worker clicks
          [Salary Received]      │              │  [Not Received]
                                 ▼              ▼
              ┌──────────────────────┐  ┌──────────────────────┐
              │    status: PAID      │  │   status: DISPUTED    │
              │    isResolved: true  │  │   isResolved: false   │
              │    confirmedAt: now  │  │   disputedAt: now     │
              └──────────────────────┘  └──────────┬───────────┘
                   (TERMINAL)                       │
                                     Admin clicks [Re-issue Payment]
                                                   │
                                                   ▼
                                     Old doc: resolvedAt = now
                                     New doc: status = PENDING_CONFIRMATION
                                     (Loop restarts from PENDING_CONFIRMATION)
```

---

### 6.2 Admin Initiates Payment — `handlePaySalary()`

**Location:** `src/services/salaryService.js`

```js
// src/services/salaryService.js
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Admin clicks [Pay Salary] / [Re-issue Payment].
 * Creates a new salary_transactions document.
 * If re-issuing after a dispute, also resolves the old document.
 */
export async function initiatePayment({
  worker,
  admin,
  computedData,
  salaryType,
  scope,
  previousDisputedTransactionId = null,
}) {
  const batch = writeBatch(db);

  // 1. If re-issuing, resolve the old disputed transaction
  if (previousDisputedTransactionId) {
    const oldRef = doc(db, 'salary_transactions', previousDisputedTransactionId);
    batch.update(oldRef, { resolvedAt: serverTimestamp() });
  }

  // 2. Create the new transaction document
  const newTxRef = doc(collection(db, 'salary_transactions'));
  batch.set(newTxRef, {
    transactionId:  newTxRef.id,
    workerId:       worker.id,
    workerName:     worker.displayName,
    adminId:        admin.uid,
    adminName:      admin.displayName,
    salaryType,
    scope: {
      projectId:    scope.projectId   ?? null,
      projectName:  scope.projectName ?? null,
      periodMonth:  scope.periodMonth ?? null,
      periodStart:  scope.periodStart ?? null,
      periodEnd:    scope.periodEnd   ?? null,
    },
    amountPaid:     computedData.totalPayable,
    hoursLogged:    computedData.totalHours ?? 0,
    breakdown: {
      basePay:       computedData.basePay       ?? null,
      overtimeHours: computedData.overtimeHours ?? null,
      overtimePay:   computedData.overtimePay   ?? null,
      daysWorked:    computedData.daysWorked     ?? null,
      hourlyRate:    computedData.hourlyRate     ?? null,
    },
    status:         'PENDING_CONFIRMATION',
    paidAt:         serverTimestamp(),
    confirmedAt:    null,
    disputedAt:     null,
    disputeNote:    null,
    resolvedAt:     null,
    isResolved:     false,
  });

  await batch.commit();
  return newTxRef.id;
}
```

---

### 6.3 Worker Confirms Receipt — `handleSalaryReceived()`

```js
/**
 * Worker clicks [Salary Received].
 * Updates the transaction to PAID. This is terminal.
 */
export async function confirmSalaryReceived(transactionId) {
  const txRef = doc(db, 'salary_transactions', transactionId);
  await updateDoc(txRef, {
    status:      'PAID',
    confirmedAt: serverTimestamp(),
    isResolved:  true,
  });
  // Note: The worker's accrued balance resets automatically on the next
  // render cycle because onSnapshot will deliver the updated document,
  // and the salary engine will exclude hours covered by PAID transactions.
}
```

**Balance reset mechanism:** There is no `balance` field to reset. The Worker View computes accrued pay at render time by running the salary engine over validated shifts and then subtracting the `hoursLogged` of all `PAID` transactions. When `isResolved` flips to `true` via `onSnapshot`, the next render cycle automatically excludes those hours from the "accrued" computation.

---

### 6.4 Worker Disputes — `handleDisputePayment()`

```js
/**
 * Worker clicks [Not Received].
 * Updates the transaction to DISPUTED. Admin will see the warning badge.
 */
export async function disputePayment(transactionId, note = '') {
  const txRef = doc(db, 'salary_transactions', transactionId);
  await updateDoc(txRef, {
    status:      'DISPUTED',
    disputedAt:  serverTimestamp(),
    disputeNote: note.trim() || null,
    isResolved:  false,
  });
}
```

---

### 6.5 Write Permission Matrix

| Operation | Who Can Write | Fields Written |
|-----------|-------------|----------------|
| Create `salary_transactions` | Admin only | All fields on creation |
| Update `status → PAID` | Worker only (own `workerId`) | `status`, `confirmedAt`, `isResolved` |
| Update `status → DISPUTED` | Worker only (own `workerId`) | `status`, `disputedAt`, `disputeNote` |
| Update `resolvedAt` | Admin only | `resolvedAt` (on old disputed doc only) |
| Write `users/{uid}.salary` | Admin only | Entire `salary` map |
| Read `users/{uid}.salary` | Owner worker + Admin | — |
| Read `salary_transactions` | Matching `workerId` + Admin | — |

---

## 7. State Management & Hook Design

### 7.1 `useSalaryDashboard(role)` — Admin Hook
**File:** `src/hooks/useSalaryDashboard.js`

```js
/**
 * Master hook for the Admin Salary View.
 * Opens and manages all Firestore listeners for the salary section.
 */
export function useSalaryDashboard() {
  const [workers, setWorkers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener 1: All workers
    const unsubWorkers = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'worker')),
      (snap) => setWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );

    // Listener 2: All unresolved transactions (for badge overlays)
    const unsubTx = onSnapshot(
      query(collection(db, 'salary_transactions'),
            where('isResolved', '==', false)),
      (snap) => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => setLoading(false),
    );

    setLoading(false);
    return () => { unsubWorkers(); unsubTx(); };
  }, []);

  return { workers, transactions, loading };
}
```

---

### 7.2 `useWorkerShifts(workerId)` — Per-Card Shift Hook
**File:** `src/hooks/useWorkerShifts.js`

```js
/**
 * Fetches all validated shifts for a specific worker.
 * Called once per <AdminWorkerSalaryCard /> render.
 * Filters to current month for monthly type; all time for hourly/project.
 */
export function useWorkerShifts(workerId) {
  const [shifts, setShifts] = useState([]);

  useEffect(() => {
    if (!workerId) return;
    const unsub = onSnapshot(
      query(
        collection(db, 'users', workerId, 'shifts'),
        where('isValidated', '==', true),
        where('status', '==', 'completed'),
        orderBy('date', 'desc'),
      ),
      (snap) => setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );
    return () => unsub();
  }, [workerId]);

  return shifts;
}
```

> **Performance note:** If the worker list is large (20+ workers), do not mount all cards simultaneously. Implement virtualization or a lazy-expand pattern where shift data is only fetched when the admin clicks to expand a worker card.

---

### 7.3 `useWorkerSalaryView()` — Worker Self-View Hook
**File:** `src/hooks/useWorkerSalaryView.js`

```js
/**
 * All data a worker needs for their own salary view.
 */
export function useWorkerSalaryView(userId) {
  const [salaryConfig, setSalaryConfig] = useState(null);
  const [transactions, setTransactions]  = useState([]);
  const [shifts, setShifts]              = useState([]);

  useEffect(() => {
    // Own user doc (for salary config)
    const unsubUser = onSnapshot(doc(db, 'users', userId), (snap) => {
      setSalaryConfig(snap.data()?.salary ?? null);
    });

    // Own transactions
    const unsubTx = onSnapshot(
      query(collection(db, 'salary_transactions'),
            where('workerId', '==', userId),
            orderBy('paidAt', 'desc')),
      (snap) => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );

    // Own validated shifts
    const unsubShifts = onSnapshot(
      query(collection(db, 'users', userId, 'shifts'),
            where('isValidated', '==', true),
            where('status', '==', 'completed')),
      (snap) => setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );

    return () => { unsubUser(); unsubTx(); unsubShifts(); };
  }, [userId]);

  // Derive the active (unresolved) transaction
  const activeTransaction = transactions.find((t) => !t.isResolved) ?? null;

  return { salaryConfig, transactions, shifts, activeTransaction };
}
```

---

## 8. Component Tree Reference

```
<SalaryPage />                          src/pages/Salary/SalaryPage.jsx
  │
  ├── [role === admin / super_admin]
  │   └── <SalaryAdminView />           src/pages/Salary/SalaryAdminView.jsx
  │         ├── <GlobalPayrollTracker />          (summary metrics bar)
  │         ├── [filter controls — type, status]
  │         └── <AdminWorkerSalaryCard />         (one per worker, grid layout)
  │               ├── <SalaryTypeBadge />
  │               ├── [body — conditional on salary.type]
  │               │     ├── <ProjectSalaryDetail />     (type === "project")
  │               │     ├── <MonthlySalaryDetail />     (type === "monthly")
  │               │     └── <HourlySalaryDetail />      (type === "hourly")
  │               └── [footer actions]
  │                     ├── <SalaryConfigModal />       (Configure Salary)
  │                     └── <PaySalaryConfirmModal />   (Pay Salary)
  │
  └── [role === worker]
      └── <SalaryWorkerView />          src/pages/Salary/SalaryWorkerView.jsx
            ├── <PendingPaymentBanner />            (if PENDING_CONFIRMATION)
            │     └── <DisputeModal />              (Not Received flow)
            ├── <WorkerSalaryBreakdown />           (current accrued pay)
            └── <PaymentHistoryList />              (past transactions)
```

**Shared/Utility components** (`src/components/salary/`):

| Component | Purpose |
|-----------|---------|
| `<SalaryTypeBadge type />` | Colored pill: PROJECT / MONTHLY / HOURLY |
| `<PaymentStatusChip status />` | PENDING / PAID / DISPUTED indicator |
| `<CurrencyAmount value />` | Wraps `formatINR()` for JSX rendering |
| `<SalarySkeletonCard />` | Loading placeholder while shifts fetch |
| `<EmptySalaryState />` | Zero-state when worker has no config |

---

## 9. Security Rules Additions

Append to `firestore.rules`. Do not modify any existing rules.

```javascript
// ── salary_transactions ────────────────────────────────────────────────────
match /salary_transactions/{transactionId} {

  // Admins and super_admins can read all transactions.
  // A worker can only read their own transactions.
  allow read: if request.auth != null &&
    (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
       in ['admin', 'super_admin'] ||
     resource.data.workerId == request.auth.uid);

  // Only admins/super_admins can CREATE a transaction document.
  allow create: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ['admin', 'super_admin'];

  // Workers can UPDATE only their own transaction, and only the handshake fields.
  // Admins can UPDATE only the resolvedAt field (when re-issuing after a dispute).
  allow update: if request.auth != null && (

    // Worker confirms or disputes their own payment
    (resource.data.workerId == request.auth.uid &&
     request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['status', 'confirmedAt', 'disputedAt', 'disputeNote', 'isResolved']))

    ||

    // Admin resolves an old disputed document
    (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
       in ['admin', 'super_admin'] &&
     request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['resolvedAt']))
  );

  // Transactions are never deleted.
  allow delete: if false;
}

// ── users/{userId}.salary config ──────────────────────────────────────────
// The existing users/{userId} rule must be extended to allow admin writes
// to the salary map field. If the existing rule is a blanket "owner can write",
// add the following exception:
match /users/{userId} {
  // Admins can write the salary map to any worker document.
  allow update: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ['admin', 'super_admin'] &&
    request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['salary']);
}
```

> **Note on the `users` rule:** The rule block above is an addition. If your existing `users` rules already handle admin writes broadly, the new `salary` field will be covered automatically. Only add this block if your existing rules restrict admin writes to specific fields.
