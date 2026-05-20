# CRM_Update_Blueprint.md
### Autonomous AI Agent Instruction Manual — CRM Upgrade v2.0
> **AGENT DIRECTIVE:** This document is your single source of truth. You must read every section in full before writing a single line of code. You will implement changes **one phase at a time** and **halt after each phase**, awaiting explicit human confirmation before proceeding to the next. Do not skip phases, do not combine phases, do not make assumptions outside of what is documented here. When a decision is ambiguous, ask for clarification before acting.

---

## Table of Contents
1. [Update Overview](#1-update-overview)
2. [Firestore Schema Expansions](#2-firestore-schema-expansions-critical)
3. [Firestore Security Rules Updates](#3-firestore-security-rules-updates)
4. [State Management & The Timer Engine](#4-state-management--the-timer-engine)
5. [Component Tree Updates](#5-component-tree-updates)
6. [Phased Implementation Plan](#6-phased-implementation-plan)

---

## 1. Update Overview

This upgrade introduces five categories of changes to the existing React + Vite + Tailwind + Firebase CRM application:

| # | Feature | Scope |
|---|---------|-------|
| 1 | **Global ₹ Symbol Replacement** | Replace all `$` currency symbols with `₹` across all UI strings, labels, and display values. |
| 2 | **Floating Shift Timer** | A persistent, draggable floating button enabling shift start/end for workers. Includes a 1-hour heartbeat ping to verify active presence. Shift data is written to Firestore and survives page refreshes via `localStorage`. |
| 3 | **Work Hour Section** | A new top-level navigation section visible to both Admins and Workers. Displays daily work hours on a calendar UI. Work hours are only validated/counted if the worker submits a `workLog` on that same day and project. |
| 4 | **Salary Section (3-Tier Engine)** | A new top-level section with three salary models: `project` (with overtime), `monthly` (20-day quota), and `hourly` (rate × hours per project). Includes a two-way "Pay Salary" / "Salary Received" handshake between Admin and Worker views. |
| 5 | **People & Project Dashboard Updates** | Worker cards in the People section show salary type and totals. Project cards gain a custom `expenses` sub-ledger and computed worker salary costs. A total project expenditure sum is shown on project cards (Admin only). |

**Backward Compatibility Guarantee:** No existing Firestore collections (`users`, `projects`, `workLogs`, `meetingLogs`, `budgetLogs`, `stageChangeLogs`) or their document structures shall be deleted or modified. All new data lives in new subcollections or new top-level collections.

---

## 2. Firestore Schema Expansions (CRITICAL)

This section defines the **exact** new data structures. The AI agent must create Firestore documents that conform precisely to these schemas. Field names are case-sensitive.

---

### 2.1 `shifts` Subcollection — under `users/{userId}/shifts/{shiftId}`

Each document in this subcollection represents a **single shift session** for a worker. Multiple shifts in one day are allowed and will be summed.

```
users/{userId}/shifts/{shiftId}
  ├── shiftId         : string   — Firestore auto-generated document ID
  ├── date            : string   — ISO date string "YYYY-MM-DD" (used as the calendar key)
  ├── startTime       : Timestamp — Firestore server timestamp of shift start
  ├── endTime         : Timestamp | null — null while shift is active; set on shift end
  ├── durationMinutes : number   — Computed on shift end: (endTime - startTime) in minutes
  ├── status          : string   — "active" | "completed" | "expired"
  │                               "expired" = shift auto-ended by missed heartbeat
  ├── lastHeartbeat   : Timestamp — Updated every time the worker confirms presence
  ├── isValidated     : boolean  — Default false. Set to true by a Cloud Function or
  │                               client-side logic when a workLog exists for this
  │                               userId on this date for any assigned project.
  └── projectId       : string | null — Optional: the project the worker is primarily
                                        logging hours against (can be null if worker
                                        is on multiple projects that day)
```

**Key business rule:** `isValidated` must only be `true` if there exists at least one `workLog` document in `projects/{projectId}/workLogs` where `createdBy == userId` AND `date == shift.date`. Validation logic is described in Phase 3.

---

### 2.2 `salaries` Top-Level Collection — `salaries/{salaryId}`

Each document defines the **salary configuration and payment state** for one worker. One document per worker. The `salaryId` should equal the worker's `userId` for easy lookup.

```
salaries/{salaryId}  (salaryId === userId)
  ├── userId          : string   — Reference to users/{userId}
  ├── salaryType      : string   — "project" | "monthly" | "hourly"
  ├── updatedAt       : Timestamp
  ├── updatedBy       : string   — Admin userId who last configured this
  │
  ├── — — — Fields for salaryType === "project" — — —
  ├── projectBasis: {
  │     projectId        : string   — The specific project this applies to
  │     projectName      : string   — Denormalized for display
  │     allocatedHours   : number   — The total contracted hours for the project
  │     agreedSalary     : number   — Total ₹ for completing allocatedHours
  │     overtimeRatePerHour : number — ₹ per hour for hours beyond allocatedHours
  │     totalWorkedHours : number   — Computed from validated shifts
  │     overtimeHours    : number   — max(0, totalWorkedHours - allocatedHours)
  │     overtimePay      : number   — overtimeHours * overtimeRatePerHour
  │     totalPayable     : number   — agreedSalary + overtimePay
  │     paymentStatus    : string   — "pending" | "paid" | "received"
  │     paidAt           : Timestamp | null
  │     receivedAt       : Timestamp | null
  │   }
  │
  ├── — — — Fields for salaryType === "monthly" — — —
  ├── monthlyBasis: {
  │     monthlySalary    : number   — Fixed ₹ per month
  │     requiredDays     : number   — Always 20
  │     hoursPerDay      : number   — 6 to 7 (configurable by admin, default 6)
  │     currentMonth     : string   — "YYYY-MM" format
  │     daysWorked       : number   — Count of distinct calendar days with
  │                                   validated shifts in currentMonth
  │     totalValidatedHours : number — Sum of durationMinutes / 60 for validated
  │                                   shifts in currentMonth
  │     paymentStatus    : string   — "pending" | "paid" | "received"
  │     paidAt           : Timestamp | null
  │     receivedAt       : Timestamp | null
  │   }
  │
  └── — — — Fields for salaryType === "hourly" — — —
      hourlyBasis: {
        ratePerHour      : number   — ₹ per hour
        projectBreakdown : array of {
          projectId        : string
          projectName      : string  — Denormalized
          totalHours       : number  — Validated hours on this project
          amountPayable    : number  — totalHours * ratePerHour
          paymentStatus    : string  — "pending" | "paid" | "received"
          paidAt           : Timestamp | null
          receivedAt       : Timestamp | null
        }
        grandTotalPayable  : number  — Sum of all amountPayable across projects
      }
```

---

### 2.3 `expenses` Subcollection — under `projects/{projectId}/expenses/{expenseId}`

Each document represents a single custom expense line item for a project.

```
projects/{projectId}/expenses/{expenseId}
  ├── expenseId    : string   — Firestore auto-generated document ID
  ├── label        : string   — e.g., "Hosting Cost", "Domain Renewal", "Equipment"
  ├── amount       : number   — ₹ value
  ├── createdAt    : Timestamp
  ├── createdBy    : string   — Admin userId
  └── category     : string   — Free-form category string e.g. "infrastructure", "misc"
```

**Computed field (not stored in Firestore — computed client-side):**
- `totalExpenses` = sum of all `expenses` documents `amount` for a project
- `totalWorkerSalaries` = sum of all payable amounts from `salaries` collection where `projectId` matches (filtered per salary type)
- `projectTotalCost` = `totalExpenses` + `totalWorkerSalaries`

These three computed values are derived at query time on the client and must **never** be stored as Firestore fields (they would become stale).

---

### 2.4 Summary of All New Firestore Paths

```
users/{userId}/shifts/{shiftId}              ← New subcollection
salaries/{salaryId}                          ← New top-level collection
projects/{projectId}/expenses/{expenseId}    ← New subcollection
```

---

## 3. Firestore Security Rules Updates

The agent must **append** the following rules to the existing `firestore.rules` file. Do not delete or overwrite existing rules. Insert these additions within the appropriate `match` blocks.

---

### 3.1 Rules for `users/{userId}/shifts/{shiftId}`

```javascript
match /users/{userId}/shifts/{shiftId} {
  allow read: if request.auth != null &&
    (request.auth.uid == userId ||
     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ["admin", "super_admin"]);
  allow create: if request.auth != null &&
    request.auth.uid == userId &&
    request.resource.data.status == "active" &&
    request.resource.data.userId == userId;
  // PATCH: Workers can update, but cannot alter the time they started the shift
  allow update: if request.auth != null &&
    request.auth.uid == userId &&
    (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['startTime']));
  allow delete: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "super_admin";
}
```

---

### 3.2 Rules for `salaries/{salaryId}`

```
match /salaries/{salaryId} {

  // A worker can read their own salary document (salaryId === userId).
  // Admins and super_admins can read any salary document.
  allow read: if request.auth != null &&
    (request.auth.uid == salaryId ||
     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
       in ["admin", "super_admin"]);

  // Only admins or super_admins can create or fully update salary configurations.
  allow create, update: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ["admin", "super_admin"];

  // EXCEPTION: A worker may update ONLY the paymentStatus field to "received"
  // on their own salary document, and only if the current status is "paid".
  // This is the "Salary Received" handshake. Implement as a restricted update rule.
  // NOTE: Due to Firestore rules limitations, enforce fine-grained field-level
  // write access via a dedicated Cloud Function instead of a raw rule, OR use
  // the following broad rule and enforce field restrictions in application logic:
  allow update: if request.auth != null &&
    request.auth.uid == salaryId &&
    request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(["projectBasis.paymentStatus", "monthlyBasis.paymentStatus",
                "hourlyBasis.projectBreakdown", "projectBasis.receivedAt",
                "monthlyBasis.receivedAt"]);

  // Salary documents are never deleted.
  allow delete: if false;
}
```

---

### 3.3 Rules for `projects/{projectId}/expenses/{expenseId}`

```
match /projects/{projectId}/expenses/{expenseId} {

  // Admins and super_admins can read all expense records.
  // Workers cannot read expense records directly.
  allow read: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ["admin", "super_admin"];

  // Only admins and super_admins can create or update expense records.
  allow create, update: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ["admin", "super_admin"];

  // Only super_admins can delete expense records.
  allow delete: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "super_admin";
}
```

---

## 4. State Management & The Timer Engine

This section defines how the frontend must manage the floating shift timer. The design priority is **resilience**: the timer state must survive page refreshes, tab closures (within the same session), and brief network interruptions.

---

### 4.1 Dual-Layer State Architecture

The timer uses a **two-layer state system**:

**Layer 1 — `localStorage` (Immediate, Local)**
- Key: `crm_active_shift`
- Value: JSON object containing:
  ```json
  {
    "shiftId": "<firestore-document-id>",
    "userId": "<uid>",
    "startTime": "<ISO timestamp string>",
    "lastHeartbeat": "<ISO timestamp string>",
    "status": "active"
  }
  ```
- Purpose: When the app loads, check `localStorage` first. If a record exists with `status: "active"`, the UI must immediately re-render the timer in its running state without waiting for Firestore. This prevents flicker and allows offline resilience.

**Layer 2 — Firestore `users/{userId}/shifts/{shiftId}` (Persistent, Source of Truth)**
- All mutations (start, heartbeat, end) must be written to Firestore.
- On app load, after restoring from `localStorage`, reconcile with Firestore: fetch the `shiftId` document and verify `status === "active"`. If Firestore says `completed` or `expired`, clear `localStorage` and update UI accordingly.

---

### 4.2 Shift Lifecycle State Machine

```
[IDLE] ──── Worker clicks Start ────► [ACTIVE]
                                          │
                                          ├── Every 1 hour: heartbeat prompt appears
                                          │       ├── Worker confirms ──► heartbeat updated, stays [ACTIVE]
                                          │       └── Grace period (5 min) expires ──► [EXPIRED]
                                          │
                                          └── Worker clicks End ──► confirmation modal ──► [COMPLETED]
```

States:
- `IDLE`: No active shift. Timer button shows "Start Shift".
- `ACTIVE`: Shift running. Timer button shows elapsed time. Heartbeat countdown running.
- `EXPIRED`: Heartbeat missed. Shift auto-closed. `endTime` set to `lastHeartbeat + 5min`. `localStorage` cleared.
- `COMPLETED`: Worker manually ended shift. `endTime` recorded. `localStorage` cleared.

---

### 4.3 The Heartbeat Engine

The heartbeat mechanism must be implemented using a combination of `setInterval` and Firestore writes:

1. When a shift starts, store `startTime` and `lastHeartbeat` in both `localStorage` and Firestore.
2. Start a `setInterval` that runs every **10 seconds** on the client. Each tick computes: `now - lastHeartbeat`.
3. When `now - lastHeartbeat >= 60 minutes`, display the heartbeat confirmation button prominently on screen. The floating timer should visually pulse or change color to draw attention.
4. The heartbeat confirmation button remains visible for exactly **5 minutes** (the grace period).
5. If the worker clicks the heartbeat button within the grace period:
   - Update `lastHeartbeat` to `now` in both `localStorage` and Firestore (`shifts/{shiftId}.lastHeartbeat`).
   - Hide the heartbeat confirmation button.
   - Reset the 60-minute interval countdown.
6. If the worker does NOT click within the grace period:
   - Set `shifts/{shiftId}.status = "expired"` and `endTime = lastHeartbeat + 5 minutes` in Firestore.
   - Compute and write `durationMinutes`.
   - Clear `localStorage`.
   - Update UI to `IDLE` state.

**On App Load / Page Refresh:**
- Read `localStorage` for active shift data.
- If found, re-attach the `setInterval`. Compute `now - lastHeartbeat` immediately on mount to check if the grace period has already passed while the page was closed/refreshed. If `now - lastHeartbeat > 65 minutes`, immediately expire the shift.
- If `now - lastHeartbeat` is between 60–65 minutes, show the heartbeat confirmation button immediately.

---

### 4.4 React Context Integration

Create a new `ShiftContext` (e.g., `src/contexts/ShiftContext.jsx`) that:
- Wraps the entire app (added to `App.jsx` provider tree).
- Exposes: `shiftState`, `startShift()`, `endShift()`, `confirmHeartbeat()`, `elapsedSeconds`, `heartbeatRequired` (boolean).
- All Firestore interactions for shifts are centralized in this context. No component should write directly to the `shifts` subcollection.
- On mount, `ShiftContext` reads from `localStorage` and reconciles with Firestore as described in §4.2.

---

## 5. Component Tree Updates

The following new components must be created. File paths are suggestions; the agent must respect the existing project's folder conventions.

---

### 5.1 New Global Components

| Component | Path (suggested) | Description |
|-----------|-----------------|-------------|
| `<FloatingShiftTimer />` | `src/components/global/FloatingShiftTimer.jsx` | The persistent draggable button. Renders in `App.jsx` outside the main router outlet so it is always visible. Consumes `ShiftContext`. Must use `position: fixed` and implement drag via `onMouseDown`/`onMouseMove` or a lightweight drag library. Persists its screen position to `localStorage` under key `crm_timer_position`. |
| `<HeartbeatConfirmModal />` | `src/components/global/HeartbeatConfirmModal.jsx` | A prominent overlay/banner (not a blocking modal) that appears when `heartbeatRequired === true` from `ShiftContext`. Displays a countdown of the remaining grace period in minutes:seconds. Contains a single "I'm Here" confirmation button. |
| `<EndShiftModal />` | `src/components/global/EndShiftModal.jsx` | A confirmation dialog shown when the worker clicks the timer button while a shift is active. Displays current elapsed time and asks "Are you sure you want to end your shift?" with Confirm/Cancel buttons. |

---

### 5.2 New Section: Work Hours

| Component | Path (suggested) | Description |
|-----------|-----------------|-------------|
| `<WorkHourSection />` | `src/pages/WorkHour/WorkHourSection.jsx` | Top-level page component for the Work Hour section. Conditionally renders `<WorkHourAdminView />` or `<WorkHourWorkerView />` based on `role` from Auth context. |
| `<WorkHourAdminView />` | `src/pages/WorkHour/WorkHourAdminView.jsx` | Renders a grid of `<WorkerSummaryCard />` for each worker. Clicking a card opens `<WorkerCalendarModal />`. |
| `<WorkerSummaryCard />` | `src/pages/WorkHour/WorkerSummaryCard.jsx` | Displays worker name, avatar/initials, and total hours this month. |
| `<WorkerCalendarModal />` | `src/pages/WorkHour/WorkerCalendarModal.jsx` | Full-screen or large modal showing a calendar for a specific worker. Dates with validated shifts are highlighted. Clicking a date shows that day's shift logs and work logs. Includes a date-range filter. |
| `<WorkHourWorkerView />` | `src/pages/WorkHour/WorkHourWorkerView.jsx` | Renders the logged-in worker's own calendar view with shift logs and work logs per day. Uses `<WorkerCalendarModal />` internally or an inline calendar. |
| `<WorkHourCalendar />` | `src/components/workHour/WorkHourCalendar.jsx` | Reusable calendar grid component. Accepts `shiftData` (array of shift documents) and `markedDates` (array of "YYYY-MM-DD" strings). Renders each month's grid with highlighted working days. Emits `onDateClick(date)` callback. |

---

### 5.3 New Section: Salary

| Component | Path (suggested) | Description |
|-----------|-----------------|-------------|
| `<SalarySection />` | `src/pages/Salary/SalarySection.jsx` | Top-level page for Salary. Renders `<SalaryAdminView />` or `<SalaryWorkerView />` based on role. |
| `<SalaryAdminView />` | `src/pages/Salary/SalaryAdminView.jsx` | Grid of `<SalaryWorkerCard />` for all workers. Includes a filter to view by salary type. |
| `<SalaryWorkerCard />` | `src/pages/Salary/SalaryWorkerCard.jsx` | Displays worker name, current salary type badge, and summary payable amount. Clicking opens `<SalaryConfigModal />`. |
| `<SalaryConfigModal />` | `src/pages/Salary/SalaryConfigModal.jsx` | Admin-only modal for configuring a worker's salary type. Contains a type selector (project / monthly / hourly) and renders the appropriate sub-form: `<ProjectSalaryForm />`, `<MonthlySalaryForm />`, or `<HourlySalaryForm />`. Includes the "Pay Salary" button. |
| `<ProjectSalaryForm />` | `src/components/salary/ProjectSalaryForm.jsx` | Form fields: project selector, allocated hours, agreed salary (₹), overtime rate (₹/hr). Displays computed overtime hours and total payable. "Pay Salary" button. |
| `<MonthlySalaryForm />` | `src/components/salary/MonthlySalaryForm.jsx` | Form fields: monthly salary (₹), hours per day (6–7). Displays days worked this month, total validated hours, and whether the 20-day quota is met. "Pay Salary" button. |
| `<HourlySalaryForm />` | `src/components/salary/HourlySalaryForm.jsx` | Rate-per-hour (₹) input. Displays a table of all assigned projects with hours worked and computed amount. "Pay Salary" button per project row. |
| `<SalaryWorkerView />` | `src/pages/Salary/SalaryWorkerView.jsx` | Worker's personal salary view. Reads from `salaries/{userId}`. Renders the correct view based on `salaryType`. Shows "Salary Received" button when `paymentStatus === "paid"`. |
| `<SalaryReceivedButton />` | `src/components/salary/SalaryReceivedButton.jsx` | Reusable button component. Disabled unless `paymentStatus === "paid"`. On click, writes `paymentStatus = "received"` and `receivedAt = serverTimestamp()` to Firestore. |

---

### 5.4 Updates to Existing Components

| Existing Component | Required Change |
|-------------------|----------------|
| `<WorkerCard />` (in People section) | Add: salary type badge, total payable salary (₹), and a link/button to open that worker's salary config in `<SalaryConfigModal />`. |
| `<ProjectCard />` (in Projects section) | Add (Admin only): total expenses (₹), total worker salaries (₹), combined project cost (₹). These values are computed client-side from `expenses` subcollection and `salaries` collection. |
| `<ProjectCreateForm />` / `<ProjectEditForm />` | Add: an `<ExpenseManager />` sub-component that allows adding/editing/removing expense line items. These are written to `projects/{projectId}/expenses/`. |
| Navigation / Sidebar | Add two new navigation items: "Work Hours" and "Salary". Both visible to `admin`, `super_admin`, and `worker` roles. |

---

### 5.5 New Shared/Utility Components

| Component | Description |
|-----------|-------------|
| `<ExpenseManager />` | A dynamic list editor for expense line items. Each row has a label input, amount (₹) input, and a remove button. Includes an "Add Expense" button. Shows a running total at the bottom. Used inside project create/edit forms. |
| `<CurrencyDisplay />` | A tiny wrapper component that formats a number as `₹XX,XXX.XX`. Use this everywhere a currency value is rendered to ensure consistency after the $ → ₹ migration. |
| `<SalaryTypeBadge />` | A small pill/badge component that accepts `type: "project" | "monthly" | "hourly"` and renders a colored label. |

---

## 6. Phased Implementation Plan

> **AGENT RULE:** Complete **all tasks within a phase** before stopping. After completing a phase, output a summary of every file changed or created, and the message: `"✅ Phase [N] complete. Awaiting human confirmation to proceed to Phase [N+1]."` Do **not** begin the next phase until the human responds with explicit approval.

---

### Phase 1 — Global Tweaks, Schema Prep & Security Rules

**Objective:** Zero-risk foundational changes that do not touch any UI logic. Everything in this phase is either a string replacement or a configuration file update.

**Tasks:**

1. **Currency Symbol Replacement ($ → ₹)**
   - Search the entire `src/` directory for all occurrences of `$` used as a currency symbol (be careful to distinguish from JavaScript template literals and variable names — only target UI string literals, JSX text content, and Tailwind/CSS label strings).
   - Replace all found instances with `₹`.
   - Create the `<CurrencyDisplay />` utility component (see §5.5) and document it in a brief comment. Do not yet refactor existing currency displays to use it — that is a future cleanup task.

2. **Firestore Security Rules Update**
   - Append the three new rule blocks from Section 3 (`shifts`, `salaries`, `expenses`) to the existing `firestore.rules` file.
   - Do not modify any existing rules.
   - Deploy the updated rules via `firebase deploy --only firestore:rules`.

3. **Firestore Indexes**
   - In `firestore.indexes.json`, add composite indexes for:
     - `users/{userId}/shifts` on fields: `date ASC`, `status ASC`
     - `salaries` on fields: `userId ASC`, `salaryType ASC`
     - `projects/{projectId}/expenses` on field: `createdAt DESC`
   - Deploy: `firebase deploy --only firestore:indexes`.

4. **Create `ShiftContext` scaffold**
   - Create `src/contexts/ShiftContext.jsx` with the full context provider structure: state variables, exported functions (`startShift`, `endShift`, `confirmHeartbeat`), and `localStorage` read on mount. At this stage, the functions may be stubbed with `console.log` placeholders — full logic is implemented in Phase 2.
   - Wrap `App.jsx` with `<ShiftProvider>`.

5. **Add Navigation Items**
   - Add "Work Hours" and "Salary" to the sidebar/navigation. Both routes should render a temporary `<ComingSoon />` placeholder page. Do not yet build the actual sections.

**Deliverables:** Updated `firestore.rules`, `firestore.indexes.json`, `App.jsx`, new `ShiftContext.jsx` scaffold, updated navigation.

---

### Phase 2 — The Floating Timer & Heartbeat Engine

**Objective:** Build the complete shift timer system end-to-end. This phase is purely additive and does not modify any existing feature components.

**Tasks:**

1. **Complete `ShiftContext` Logic**
   - Implement `startShift()`:
     - Create a new document in `users/{userId}/shifts/` with `status: "active"`, `startTime: serverTimestamp()`, `lastHeartbeat: serverTimestamp()`, `date: today's YYYY-MM-DD`, `endTime: null`.
     - Write the `shiftId`, `startTime` (as ISO string), and `lastHeartbeat` to `localStorage` under `crm_active_shift`.
   - Implement the `setInterval` (10-second tick) inside a `useEffect` that:
     - Computes elapsed time since `startTime` (for display).
     - Computes time since `lastHeartbeat` (to trigger heartbeat prompt).
     - Sets `heartbeatRequired = true` when `now - lastHeartbeat >= 60 minutes`.
     - Auto-expires the shift when `now - lastHeartbeat >= 65 minutes`.
   - Implement `confirmHeartbeat()`:
     - Update `shifts/{shiftId}.lastHeartbeat` in Firestore.
     - Update `lastHeartbeat` in `localStorage`.
     - Set `heartbeatRequired = false`.
   - Implement `endShift()`:
     - Update `shifts/{shiftId}` with `status: "completed"`, `endTime: serverTimestamp()`, compute and write `durationMinutes`.
     - Clear `localStorage` (`crm_active_shift`).
     - Reset all timer state.
   - Implement on-mount reconciliation (see §4.3).

2. **Build `<FloatingShiftTimer />`**
   - `position: fixed`, rendered in `App.jsx` above the router outlet.
   - Displays "Start Shift" when `IDLE`. Displays a live `HH:MM:SS` counter when `ACTIVE`.
   - Implement drag behavior using `onMouseDown` + `onMouseMove` + `onMouseUp` on the `window`. Store final position in `localStorage` under `crm_timer_position`. On mount, restore position from `localStorage`.
   - On click when `IDLE`: call `startShift()`.
   - On click when `ACTIVE`: open `<EndShiftModal />`.
   - Visually differentiate `ACTIVE` state (e.g., green background) from `IDLE` (neutral) and `heartbeatRequired` (pulsing amber/yellow).

3. **Build `<HeartbeatConfirmModal />`**
   - Render conditionally when `heartbeatRequired === true` from `ShiftContext`.
   - Display the remaining grace period countdown (5:00 → 0:00).
   - "I'm Here" button calls `confirmHeartbeat()`.
   - Must NOT block UI interaction (use a fixed-position non-modal banner at the top or bottom of the screen).

4. **Build `<EndShiftModal />`**
   - Standard confirmation modal.
   - Display current session elapsed time.
   - On confirm: call `endShift()`.

**Deliverables:** Fully functional shift timer system. A worker can start a shift, see it persist through a page refresh, receive heartbeat prompts, and end the shift.

---

### Phase 3 — Work Hours Section & Calendar UI

**Objective:** Build the Work Hours section in full for both Admin and Worker views, including calendar rendering and shift validation logic.

**Tasks:**

1. **Shift Validation Logic**
   - Write a utility function `validateShiftsForDate(userId, date)` in `src/utils/shiftValidation.js`.
   - Logic: Query `projects` where `assignedWorkers` array contains `userId`. For each such project, query `projects/{projectId}/workLogs` where `createdBy == userId` AND the workLog's date field matches `date`. If any workLog is found, return `true`.
   - This function is called after a shift ends (`endShift()`) and also on a scheduled basis in the Work Hours section. When it returns `true`, update `shifts/{shiftId}.isValidated = true` in Firestore.
   - **Important:** Run validation for the current day's shifts when the Work Hours section is opened, to catch any shifts that were completed before a workLog was submitted.

2. **Build `<WorkHourCalendar />`**
   - A pure presentational component accepting: `year`, `month`, `shiftData` (array of shift documents for the month), `onDateClick`.
   - Render a standard monthly calendar grid.
   - Days that have at least one validated shift: highlighted in green.
   - Days with shifts that are not validated: highlighted in amber.
   - Days with no shift data: default styling.
   - Display total validated hours as a small badge on each day cell.

3. **Build Worker View (`<WorkHourWorkerView />`)**
   - On load, query `users/{currentUserId}/shifts` where `date` falls in the current month.
   - Group results by date.
   - Render `<WorkHourCalendar />`.
   - On `onDateClick(date)`: expand a panel below the calendar (or a side drawer) showing:
     - List of shift sessions that day (start time, end time, duration, validated status).
     - List of workLogs submitted that day (fetched from all assigned projects).

4. **Build Admin View (`<WorkHourAdminView />`)**
   - Fetch all users with `role === "worker"` from the `users` collection.
   - Render each as a `<WorkerSummaryCard />` showing name and total validated hours this month.
   - Clicking a card opens `<WorkerCalendarModal />`.

5. **Build `<WorkerCalendarModal />`**
   - Full-screen modal or drawer.
   - Header: worker name, month/year selector (prev/next arrows), and a date-range filter (date picker inputs for "from" and "to" dates).
   - Body: `<WorkHourCalendar />` for the selected worker.
   - On date click: show the same day-detail panel as in the Worker View.
   - Fetch only shifts within the selected date range to avoid over-fetching.

6. **Update Navigation**
   - Replace the "Coming Soon" placeholder for "Work Hours" with `<WorkHourSection />`.

**Deliverables:** Fully functional Work Hours section with calendar, day-level drill-down, shift validation, and both Admin and Worker views.

---

### Phase 4 — The 3-Tier Salary Engine & Handshake UI

**Objective:** Build the complete Salary section with all three payment models and the two-way payment handshake.

**Tasks:**

1. **Salary Data Service**
   - Create `src/services/salaryService.js` with the following functions:
     - `getSalaryDoc(userId)` — Fetch `salaries/{userId}`.
     - `setSalaryType(userId, type, configData)` — Create or overwrite `salaries/{userId}` with the new type and config.
     - `markSalaryPaid(userId, projectId?)` — Admin action. Set `paymentStatus = "paid"`, `paidAt = serverTimestamp()`.
     - `markSalaryReceived(userId, projectId?)` — Worker action. Set `paymentStatus = "received"`, `receivedAt = serverTimestamp()`. Must validate that current `paymentStatus === "paid"` before writing.
     - `computeProjectSalary(userId, salaryDoc, shiftsData)` — Pure function (no Firestore call). Accepts the salary doc and the worker's validated shifts array. Returns `{ overtimeHours, overtimePay, totalPayable }`.
     - `computeMonthlySalary(salaryDoc, shiftsData)` — Returns `{ daysWorked, totalHours, isQuotaMet }`.
     - `computeHourlySalary(salaryDoc, shiftsData)` — Returns `projectBreakdown[]` and `grandTotalPayable`.

2. **Build `<SalaryAdminView />` and `<SalaryWorkerCard />`**
   - Fetch all workers and their `salaries` documents.
   - Display `<SalaryTypeBadge />` on each card.
   - Show a computed total payable amount.

3. **Build `<SalaryConfigModal />` with sub-forms**
   - The type selector must clear and reset the form when the type changes.
   - Each sub-form must display real-time computed values (overtime, total, etc.) using the compute functions from `salaryService.js`.
   - "Pay Salary" button: calls `markSalaryPaid()` from `salaryService.js`. Disable the button if `paymentStatus` is already `"paid"` or `"received"`.
   - Show `paymentStatus` clearly: `"pending"` → grey, `"paid"` → blue (awaiting worker confirmation), `"received"` → green (complete).

4. **Build `<SalaryWorkerView />`**
   - Fetch `salaries/{currentUserId}` on mount.
   - Based on `salaryType`, render the appropriate read-only summary view.
   - For `project` type: show project name, allocated hours, hours worked, overtime, total payable.
   - For `monthly` type: show days worked this month, monthly salary, quota progress bar.
   - For `hourly` type: show a table of projects with hours and amounts.
   - Render `<SalaryReceivedButton />` when applicable.

5. **Build `<SalaryReceivedButton />`**
   - Calls `markSalaryReceived()` from `salaryService.js`.
   - Shows a loading spinner during the async operation.
   - After success, updates to a disabled "Salary Confirmed ✓" state.

6. **Update Navigation**
   - Replace the "Coming Soon" placeholder for "Salary" with `<SalarySection />`.

**Deliverables:** Fully functional Salary section. Admin can assign salary types, view computed amounts, and mark as paid. Worker can view their salary details and confirm receipt.

---

### Phase 5 — Project & People Dashboard Updates

**Objective:** Update the existing People and Project sections to surface salary info and project cost data. This is the only phase that modifies existing components.

> **AGENT CAUTION:** This phase modifies existing components. Before editing any file, read its current code in full. Make surgical, minimal changes. Do not refactor code unrelated to the tasks below.

**Tasks:**

1. **`<ExpenseManager />` Component**
   - Build the reusable expense line-item editor (see §5.5).
   - It must accept `projectId` and manage its own Firestore reads/writes to `projects/{projectId}/expenses/`.
   - Show a running ₹ total below the list.

2. **Update `<ProjectCreateForm />` and `<ProjectEditForm />`**
   - After a project is saved and has a valid `projectId`, render `<ExpenseManager projectId={projectId} />` as a new section within the form titled "Project Expenses".
   - For new projects, `<ExpenseManager />` should only render after the project document has been created (i.e., after the initial save step).

3. **Update `<ProjectCard />`** (Admin view only)
   - On card load, fetch the `expenses` subcollection for the project and compute `totalExpenses`.
   - Query the `salaries` collection for workers assigned to this project and compute `totalWorkerSalaries` using the salary compute functions.
   - Display three new fields in a cost summary section at the bottom of the card:
     - `Expenses: ₹XX,XXX`
     - `Worker Salaries: ₹XX,XXX`
     - `Total Cost: ₹XX,XXX` (bold)
   - These fields must be wrapped in a role check — only render when `role === "admin"` or `role === "super_admin"`.
   - To avoid N+1 query problems: batch the expenses and salary fetches. Do not fire one Firestore query per card render if multiple cards are visible. Consider fetching all relevant salary data once at the section level and passing it down as props.

4. **Update `<WorkerCard />` in People Section**
   - Fetch `salaries/{workerId}` for each worker card.
   - Add to the card:
     - `<SalaryTypeBadge type={salaryDoc.salaryType} />`
     - A "Total Payable" field showing the computed total salary using the salary compute functions.
   - Add a small "Configure Salary" link/icon that opens `<SalaryConfigModal />` for that worker directly from the People section.

5. **Final Integration Check**
   - Verify that the `<FloatingShiftTimer />` remains visible and functional on all new pages (Work Hours, Salary, People, Projects).
   - Verify that the `<HeartbeatConfirmModal />` appears correctly on all pages.
   - Do a final pass to ensure no `$` currency symbols remain in any UI-facing string.
   - Run the application and confirm no console errors on load for each new section.

**Deliverables:** Updated People and Projects sections with salary info and expense breakdowns. Full end-to-end system integration. All 5 features live and functional.

---

## Appendix A — Key Constants & Configuration

The agent should define these as constants in a shared config file (e.g., `src/config/shiftConfig.js`):

```js
export const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000;   // 60 minutes
export const HEARTBEAT_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes
export const HEARTBEAT_CHECK_INTERVAL_MS = 10 * 1000;   // 10 seconds (client tick)
export const MONTHLY_REQUIRED_DAYS = 20;
export const MONTHLY_HOURS_PER_DAY_DEFAULT = 6;
export const LOCAL_STORAGE_SHIFT_KEY = "crm_active_shift";
export const LOCAL_STORAGE_TIMER_POS_KEY = "crm_timer_position";
```

---

## Appendix B — Salary Type Decision Matrix

| Condition | salaryType | Key Fields |
|-----------|-----------|-----------|
| Worker paid per project completion | `"project"` | `allocatedHours`, `agreedSalary`, `overtimeRatePerHour` |
| Worker paid fixed monthly | `"monthly"` | `monthlySalary`, `requiredDays: 20`, `hoursPerDay` |
| Worker paid per hour worked | `"hourly"` | `ratePerHour`, `projectBreakdown[]` |

---

## Appendix C — Agent Checklist Before Each Phase

Before beginning any phase, the agent must confirm:
- [ ] All existing tests (if any) still pass from the previous phase.
- [ ] No new console errors or warnings introduced.
- [ ] All new Firestore writes use `serverTimestamp()` for time fields, never `new Date()`.
- [ ] All currency values displayed in the UI use `₹` and are formatted to 2 decimal places.
- [ ] All new components handle loading and error states (show a spinner / error message, never crash).
- [ ] No hardcoded user IDs, project IDs, or collection paths (use variables/constants).
- [ ] Role-based access control is enforced at the component level (not just Firestore rules).
