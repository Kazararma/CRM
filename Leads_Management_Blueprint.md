# Leads Management Module — Developer Blueprint
### Wavelet CRM · React 18 + Vite + Tailwind CSS + Lucide React + Firebase Firestore

> **Scope of this document:** This blueprint is the complete specification for the Leads Management module. It covers the Firestore schema, all component hierarchies, state management patterns, Firebase query strategies, phase-transition logic, the Negotiation financial engine, and the Final → Project conversion handshake. Implement every section in the order presented. Do not modify any existing collection (`users`, `projects`, `shifts`, `salary_transactions`).

---

## Table of Contents
1. [Module Overview & Constraints](#1-module-overview--constraints)
2. [Firestore Database Schema](#2-firestore-database-schema)
3. [Component Architecture](#3-component-architecture)
4. [Lead Card Modal & Phase Interactions](#4-lead-card-modal--phase-interactions)
5. [The Conversion Handshake — Final → Project](#5-the-conversion-handshake--final--project)
6. [State Management & Hook Design](#6-state-management--hook-design)
7. [Firebase Query Patterns](#7-firebase-query-patterns)
8. [Security Rules Additions](#8-security-rules-additions)
9. [Component Tree Reference](#9-component-tree-reference)

---

## 1. Module Overview & Constraints

### 1.1 Visibility
The Leads section is **exclusively visible to `admin` and `super_admin` roles**. Apply the role check at the route level — the route must not render at all for workers, not merely hide the navigation link.

```jsx
// src/routes/ProtectedRoute.jsx (or equivalent guard)
if (!['admin', 'super_admin'].includes(currentUser.role)) {
  return <Navigate to="/dashboard" replace />;
}
```

### 1.2 Currency Formatting
All monetary values (estimated billing, budget cost, client agreed amount, client paid amount, total profit) must be rendered through the existing `formatINR` utility. Never inline-format a ₹ value.

```js
import { formatINR } from '../utils/formatCurrency';
// Usage: formatINR(lead.estimatedBilling) → "₹1,50,000.00"
```

### 1.3 Real-Time Data
Every piece of data rendered in this module must be driven by Firestore `onSnapshot` listeners. One-shot `getDocs` calls are not permitted. Every listener must be established in a `useEffect` and cleaned up by returning its unsubscribe function.

### 1.4 Lead Categories & Phases — Master Reference

**Categories** (set at creation, cannot be changed after):
| Value | Display | Color Token |
|-------|---------|-------------|
| `"hot"` | 🔴 Hot | `red-500` |
| `"neutral"` | 🟡 Neutral | `yellow-500` |
| `"cold"` | 🔵 Cold | `blue-400` |

**Phases** (progress lifecycle, changed by admin):
| Value | Display | Transitions Allowed |
|-------|---------|-------------------|
| `"initial"` | Initial | → negotiation, → failed |
| `"negotiation"` | Negotiation | → final, → failed |
| `"final"` | Final | → (conversion to project) |
| `"failed"` | Failed | (terminal — delete only) |

Phase rules:
- Every lead starts in `"initial"` phase at creation.
- Phase can only move **forward** (initial → negotiation → final) or be marked **failed** from any non-final phase.
- The `"final"` phase is terminal pending conversion. Once converted, the lead's `isConverted` flag is set to `true` and the lead card becomes read-only.
- The `"failed"` phase is the only phase that exposes a delete button.

---

## 2. Firestore Database Schema

### 2.1 `leads` Collection — `leads/{leadId}`

```
leads/{leadId}
  │
  ├── // ── Identity ─────────────────────────────────────────────────────────
  ├── leadId:              string      // Auto-generated Firestore document ID
  ├── projectTitle:        string      // Name/title of the prospective project
  ├── description:         string      // Brief description of the lead scope
  │
  ├── // ── Contact ──────────────────────────────────────────────────────────
  ├── source:              string      // Where the lead came from (e.g., "Referral",
  │                                   //   "LinkedIn", "Cold Call", "Website", "Other")
  ├── phoneNumber:         string      // Lead's contact phone number
  ├── email:               string      // Lead's contact email address
  ├── clientName:          string      // Name of the prospective client/company
  │
  ├── // ── Classification ───────────────────────────────────────────────────
  ├── category:            string      // "hot" | "neutral" | "cold"
  │                                   // Set at creation. IMMUTABLE after creation.
  ├── phase:               string      // "initial" | "negotiation" | "final" | "failed"
  │                                   // Default: "initial"
  │
  ├── // ── Financial — Initial Estimates ───────────────────────────────────
  ├── estimatedBilling:    number      // ₹ — what admin expects to bill the client
  ├── estimatedBudget:     number      // ₹ — estimated internal cost/budget
  │
  ├── // ── Financial — Negotiation (populated in negotiation phase) ─────────
  ├── negotiation: {
  │     askedFromClient:   number      // ₹ — what was asked of the client
  │     clientAgreedOn:    number      // ₹ — what client agreed to pay
  │     clientPaidAmount:  number      // ₹ — amount actually received so far
  │   }
  │
  ├── // ── Financial — Final (locked values used for project conversion) ─────
  ├── finalBilling:        number      // ₹ — locked billing (= negotiation.clientAgreedOn
  │                                   //   if negotiation occurred; else estimatedBilling)
  ├── finalBudget:         number      // ₹ — locked budget (= estimatedBudget unless
  │                                   //   admin updates during negotiation)
  │
  ├── // ── Conversion ───────────────────────────────────────────────────────
  ├── isConverted:         boolean     // false by default; true after conversion to project
  ├── convertedProjectId:  string | null  // Firestore ID of the created project doc
  ├── convertedAt:         Timestamp | null
  ├── convertedBy:         string | null  // uid of admin who converted
  │
  ├── // ── Metadata ─────────────────────────────────────────────────────────
  ├── createdAt:           Timestamp   // serverTimestamp() on creation
  ├── createdBy:           string      // uid of admin who created the lead
  ├── updatedAt:           Timestamp   // serverTimestamp() on every update
  ├── updatedBy:           string      // uid of admin who last updated
  └── isDeleted:           boolean     // Soft-delete flag. True only for failed leads.
                                      // Never hard-delete a lead document.
```

---

### 2.2 `lead_logs` Subcollection — `leads/{leadId}/lead_logs/{logId}`

Each document tracks one log entry (a communication, a meeting note, a follow-up action) made by an admin for this lead.

```
leads/{leadId}/lead_logs/{logId}
  ├── logId:       string      // Auto-generated Firestore document ID
  ├── content:     string      // The log message / note content
  ├── phase:       string      // The lead's phase at the time of logging
  │                            // Snapshot — does not update if phase changes later
  ├── loggedBy:    string      // uid of admin who wrote the log
  ├── loggerName:  string      // Denormalized display name
  ├── createdAt:   Timestamp   // serverTimestamp()
  └── attachments: string[]    // Optional array of file download URLs (Firebase Storage)
                               // Empty array by default
```

---

### 2.3 Schema Summary

```
leads/{leadId}                          ← New top-level collection
  └── lead_logs/{logId}                 ← New subcollection

(The existing `projects` collection receives new documents during conversion —
 no schema change to projects itself, but see §5 for the field mapping.)
```

---

### 2.4 Required Composite Indexes — `firestore.indexes.json`

```json
[
  {
    "collectionGroup": "leads",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted",  "order": "ASCENDING" },
      { "fieldPath": "category",   "order": "ASCENDING" },
      { "fieldPath": "createdAt",  "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "leads",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted",  "order": "ASCENDING" },
      { "fieldPath": "phase",      "order": "ASCENDING" },
      { "fieldPath": "createdAt",  "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "lead_logs",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "createdAt",  "order": "DESCENDING" }
    ]
  }
]
```

---

## 3. Component Architecture

### 3.1 Route & Page Entry

**Route:** `/leads`
**Top-level component:** `src/pages/Leads/LeadsPage.jsx`

`LeadsPage` is responsible for:
1. Role-gating (redirect non-admins).
2. Owning the global `onSnapshot` listener for the entire `leads` collection.
3. Maintaining the active time-frame filter state.
4. Rendering the `<LeadsMetricsBar />`, `<LeadsTimeFilter />`, and `<LeadsKanbanBoard />`.

```jsx
// LeadsPage.jsx — top-level data owner
const { leads, loading } = useLeads(timeframeFilter);
const metrics = useLeadsMetrics(leads);
```

---

### 3.2 `<LeadsMetricsBar />`

**File:** `src/pages/Leads/LeadsMetricsBar.jsx`

A horizontal summary bar at the top of the Leads page. All values are derived from the `leads` array passed as props — no additional Firestore queries.

**Displayed metrics:**

| Metric | Derivation |
|--------|-----------|
| **Total Leads** | `leads.filter(l => !l.isDeleted).length` |
| **Hot / Neutral / Cold** | Count per category (mini colored counters) |
| **Converted to Project** | `leads.filter(l => l.isConverted).length` |
| **Total Profit** | `leads.filter(l => l.isConverted).reduce((sum, l) => sum + l.finalBilling, 0)` — displayed via `formatINR()` |
| **Pending (non-failed, non-converted)** | Count of active leads |

**Props:**
```ts
interface LeadsMetricBarProps {
  leads: LeadDocument[];
}
```

---

### 3.3 `<LeadsTimeFilter />`

**File:** `src/pages/Leads/LeadsTimeFilter.jsx`

A filter control that scopes the visible leads by their `createdAt` date.

**Filter modes:**
| Mode | Behaviour |
|------|-----------|
| `"this_month"` | Default. Shows leads created in the current calendar month. |
| `"last_month"` | Previous calendar month. |
| `"last_3_months"` | Rolling 3-month window from today. |
| `"custom"` | Exposes two date pickers: `fromDate` and `toDate`. |

**Implementation:** The filter state lives in `LeadsPage` as `timeframeFilter`. The `useLeads` hook accepts this value and applies it as a Firestore `where` constraint on `createdAt`. When the filter changes, the `onSnapshot` listener is re-subscribed with the new date bounds (handle via `useEffect` dependency on filter state).

**Props:**
```ts
interface LeadsTimeFilterProps {
  value: TimeframeFilter;
  onChange: (filter: TimeframeFilter) => void;
}

type TimeframeFilter =
  | { mode: 'this_month' | 'last_month' | 'last_3_months' }
  | { mode: 'custom'; fromDate: Date; toDate: Date };
```

---

### 3.4 `<LeadsKanbanBoard />`

**File:** `src/pages/Leads/LeadsKanbanBoard.jsx`

The primary content area. A three-column layout, one column per category.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  🔴 HOT (N)          🟡 NEUTRAL (N)         🔵 COLD (N)     │
│  ──────────────      ──────────────         ──────────────   │
│  [LeadCard]          [LeadCard]              [LeadCard]       │
│  [LeadCard]          [LeadCard]              [LeadCard]       │
│  [+ Create Lead]     [+ Create Lead]         [+ Create Lead]  │
└──────────────────────────────────────────────────────────────┘
```

**Column header:** Category name, count of visible leads in that column, category color badge.

**"+ Create Lead" button:** Positioned at the bottom of each column. Clicking it opens `<CreateLeadModal />` with the category pre-selected to that column's category.

**Props:**
```ts
interface LeadsKanbanBoardProps {
  leads: LeadDocument[];         // Pre-filtered by timeframe
  onLeadClick: (lead: LeadDocument) => void;
  onCreateLead: (defaultCategory: LeadCategory) => void;
}
```

**Filtering within the board:** The `leads` array passed to the board is already timeframe-filtered. The board itself partitions by `category` using `useMemo`:
```js
const hotLeads      = useMemo(() => leads.filter(l => l.category === 'hot'     && !l.isDeleted), [leads]);
const neutralLeads  = useMemo(() => leads.filter(l => l.category === 'neutral' && !l.isDeleted), [leads]);
const coldLeads     = useMemo(() => leads.filter(l => l.category === 'cold'    && !l.isDeleted), [leads]);
```

---

### 3.5 `<LeadCard />`

**File:** `src/components/leads/LeadCard.jsx`

A compact card rendered inside a Kanban column.

**Displayed information:**
- Project title (bold, truncated at 2 lines)
- Client name
- Source badge (small pill)
- Phase badge — color-coded:
  - `initial` → grey
  - `negotiation` → amber
  - `final` → green
  - `failed` → red
- Estimated Billing: `formatINR(lead.estimatedBilling)`
- `createdAt` formatted as `DD MMM YYYY`
- If `isConverted`: a green "✓ Converted" overlay banner on the card

**Interaction:** Entire card is clickable → calls `onLeadClick(lead)` → opens `<LeadDetailModal />`.

**Props:**
```ts
interface LeadCardProps {
  lead: LeadDocument;
  onClick: (lead: LeadDocument) => void;
}
```

---

### 3.6 `<CreateLeadModal />`

**File:** `src/components/leads/CreateLeadModal.jsx`

A modal form for creating a new lead.

**Form fields:**

| Field | Type | Validation |
|-------|------|-----------|
| Project Title | text input | Required, max 100 chars |
| Client Name | text input | Required |
| Source | dropdown | Required. Options: "Referral", "LinkedIn", "Cold Call", "Website", "Email Campaign", "Other" |
| Phone Number | tel input | Required |
| Email ID | email input | Required, email format |
| Description | textarea | Required, max 500 chars |
| Estimated Billing (₹) | number input | Required, min 0 |
| Estimated Budget (₹) | number input | Required, min 0 |
| Category | radio group | Required. Hot / Neutral / Cold. Pre-selected if opened from a column. |

**On Submit — Firestore write:**
```js
await addDoc(collection(db, 'leads'), {
  projectTitle:       formData.projectTitle,
  clientName:         formData.clientName,
  description:        formData.description,
  source:             formData.source,
  phoneNumber:        formData.phoneNumber,
  email:              formData.email,
  category:           formData.category,          // immutable after this point
  phase:              'initial',                  // always "initial" on creation
  estimatedBilling:   Number(formData.estimatedBilling),
  estimatedBudget:    Number(formData.estimatedBudget),
  negotiation:        { askedFromClient: 0, clientAgreedOn: 0, clientPaidAmount: 0 },
  finalBilling:       Number(formData.estimatedBilling),  // pre-populated, updated on conversion
  finalBudget:        Number(formData.estimatedBudget),
  isConverted:        false,
  convertedProjectId: null,
  convertedAt:        null,
  convertedBy:        null,
  createdAt:          serverTimestamp(),
  createdBy:          currentUser.uid,
  updatedAt:          serverTimestamp(),
  updatedBy:          currentUser.uid,
  isDeleted:          false,
});
```

---

## 4. Lead Card Modal & Phase Interactions

### 4.1 `<LeadDetailModal />`

**File:** `src/components/leads/LeadDetailModal.jsx`

A full-screen or large modal (min-height 80vh) opened when a lead card is clicked. This is the primary interaction surface for all lead management.

**Internal state:**
```js
const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'logs' | 'financials'
```

**Owns its own `onSnapshot` listener** for `leads/{leadId}/lead_logs` ordered by `createdAt DESC`. This ensures log updates are real-time while the modal is open.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  [Category Badge]  [Project Title]        [Phase Badge]  │
│  Client: [name]  |  Source: [source]  |  [createdAt]    │
│─────────────────────────────────────────────────────────│
│  [Overview] [Logs] [Financials]          ← Tab nav       │
│─────────────────────────────────────────────────────────│
│  [Tab Content — see below]                               │
│─────────────────────────────────────────────────────────│
│  [Phase Selector]    [Action Buttons]                    │
└─────────────────────────────────────────────────────────┘
```

---

### 4.2 Overview Tab

Shows all static lead information in a structured read-only layout:
- Contact details: email, phone
- Description (full text)
- Financial summary: Estimated Billing / Estimated Budget (formatted with `formatINR`)
- Timestamps: Created at, Last updated at, Created by (admin name)

---

### 4.3 Logs Tab — `<LeadLogsPanel />`

**File:** `src/components/leads/LeadLogsPanel.jsx`

Displays the `lead_logs` subcollection and provides a text area to add new entries.

**Log list:** Reverse-chronological. Each entry shows:
- Logger name + avatar initials
- Phase snapshot badge (the phase the lead was in when logged)
- Timestamp: `DD MMM YYYY, HH:MM`
- Content (full text)
- Attachment links (if any)

**Add Log form (at the top, above the list):**
- Textarea: "Log a note, communication, or update..."
- `[+ Add Log]` button

**On submit:**
```js
await addDoc(collection(db, 'leads', leadId, 'lead_logs'), {
  content:     logContent.trim(),
  phase:       currentLead.phase,   // snapshot of current phase
  loggedBy:    currentUser.uid,
  loggerName:  currentUser.displayName,
  createdAt:   serverTimestamp(),
  attachments: [],
});
```

After submission, clear the textarea. The `onSnapshot` listener will automatically append the new log to the list.

---

### 4.4 Financials Tab — `<LeadFinancialsPanel />`

**File:** `src/components/leads/LeadFinancialsPanel.jsx`

Renders differently based on `lead.phase`.

**For `initial` phase:**
- Read-only display of `estimatedBilling` and `estimatedBudget`.
- Message: "Financial negotiation details will appear when this lead enters the Negotiation phase."

**For `negotiation` phase — the Negotiation Financial Engine:**

This is the primary phase-specific UI. The following editable fields are exposed:

| Field | Firestore path | Description |
|-------|---------------|-------------|
| Asked from Client (₹) | `negotiation.askedFromClient` | What the admin quoted to the client |
| Client Agreed On (₹) | `negotiation.clientAgreedOn` | The amount the client committed to |
| Client Paid Amount (₹) | `negotiation.clientPaidAmount` | Amount received so far (can be partial) |

**Behaviour on save:**
When the admin saves the Negotiation fields, the following fields are updated atomically:
```js
await updateDoc(doc(db, 'leads', leadId), {
  'negotiation.askedFromClient':  Number(formData.askedFromClient),
  'negotiation.clientAgreedOn':   Number(formData.clientAgreedOn),
  'negotiation.clientPaidAmount': Number(formData.clientPaidAmount),
  // Lock the final values to the agreed amounts:
  finalBilling:                   Number(formData.clientAgreedOn),
  finalBudget:                    lead.estimatedBudget,   // budget stays as estimated
  updatedAt:                      serverTimestamp(),
  updatedBy:                      currentUser.uid,
});
```

**Derived display (computed client-side, not stored):**
- Outstanding Balance: `formatINR(negotiation.clientAgreedOn - negotiation.clientPaidAmount)`
- Margin: `formatINR(negotiation.clientAgreedOn - lead.estimatedBudget)` (amber if negative)

**For `final` phase:**
- All negotiation fields rendered as **read-only**.
- Locked `finalBilling` and `finalBudget` displayed prominently.
- The `[Convert to Project]` button is displayed here and in the modal footer.

**For `failed` phase:**
- Read-only display of all financial data.
- No edit controls.

---

### 4.5 Phase Selector — `<LeadPhaseSelector />`

**File:** `src/components/leads/LeadPhaseSelector.jsx`

Rendered in the modal footer, left side. A horizontal stepper or segmented control.

**Rules enforced in the component (not just in Firestore rules):**
- `initial` → allowed transitions: `negotiation`, `failed`
- `negotiation` → allowed transitions: `final`, `failed`
- `final` → no further phase changes (lead is either converted or stays in final)
- `failed` → no phase changes (terminal)
- Converted leads (`isConverted === true`) → entire phase selector is disabled and read-only

**On phase change:**
```js
const handlePhaseChange = async (newPhase) => {
  await updateDoc(doc(db, 'leads', leadId), {
    phase:     newPhase,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });
  // Auto-log the phase change:
  await addDoc(collection(db, 'leads', leadId, 'lead_logs'), {
    content:    `Phase changed to "${newPhase}" by ${currentUser.displayName}.`,
    phase:      newPhase,
    loggedBy:   currentUser.uid,
    loggerName: currentUser.displayName,
    createdAt:  serverTimestamp(),
    attachments: [],
  });
};
```

Phase changes are auto-logged. The admin does not need to manually write a log for phase transitions.

---

### 4.6 Action Buttons — Modal Footer (Right Side)

Buttons rendered conditionally based on `lead.phase` and `lead.isConverted`:

| Condition | Button(s) shown |
|-----------|----------------|
| Any non-failed, non-converted lead | `[Edit Lead Info]` |
| `phase === 'final'` AND `!isConverted` | `[Convert to Project]` (green, prominent) |
| `phase === 'failed'` | `[🗑 Delete Lead]` (red, destructive styling) |
| `isConverted === true` | `[View Project →]` (navigates to the converted project) |

**`[Edit Lead Info]`** opens an inline edit mode within the Overview tab for non-financial fields (title, description, contact info). `category` remains disabled and non-editable.

**`[Delete Lead]`** — strictly only for `failed` phase:
```js
// Soft delete — never hard delete
const handleDeleteLead = async () => {
  if (!window.confirm('Permanently remove this failed lead? This cannot be undone.')) return;
  await updateDoc(doc(db, 'leads', leadId), {
    isDeleted:  true,
    updatedAt:  serverTimestamp(),
    updatedBy:  currentUser.uid,
  });
  closeModal();
};
```

The `isDeleted` flag removes the lead from all `onSnapshot` queries (which filter `where('isDeleted', '==', false)`). The document is retained in Firestore for audit purposes.

---

## 5. The Conversion Handshake — Final → Project

### 5.1 User-Facing Flow

```
Admin opens a lead in "final" phase
  └── Clicks [Convert to Project]
        └── <ConvertToProjectConfirmModal /> appears
              "Convert '[Project Title]' to an active project?
               Billing: ₹[finalBilling] | Budget: ₹[finalBudget]
               The lead will be locked and a new project will be created.
               You will need to complete the remaining project fields
               in the Projects section."
              
              [Cancel]    [Confirm & Convert]
                               │
                               ▼
                    Firestore batch write executes
                               │
                               ▼
                    Lead card shows "✓ Converted" overlay
                    Toast: "Project created. Complete setup in Projects →"
                    [View Project →] button appears in modal
```

---

### 5.2 Firestore Batch Transaction

The conversion is executed as a single `writeBatch` to guarantee atomicity. If any write fails, neither document is changed.

**File:** `src/services/leadsService.js`

```js
import {
  writeBatch, doc, collection,
  serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Converts a lead in "final" phase to a new project document.
 * Atomic: both writes succeed or both fail.
 *
 * @param {LeadDocument} lead     - The full lead document object
 * @param {string}       adminUid - UID of the admin performing the conversion
 * @param {string}       adminName
 * @returns {Promise<string>}     - The new project's Firestore document ID
 */
export async function convertLeadToProject(lead, adminUid, adminName) {
  const batch = writeBatch(db);

  // ── Step 1: Create the new project document ──────────────────────────────
  const newProjectRef = doc(collection(db, 'projects'));

  batch.set(newProjectRef, {
    // ── Fields mapped directly from the lead ──────────────────────────────
    title:              lead.projectTitle,
    description:        lead.description,
    clientName:         lead.clientName,
    clientEmail:        lead.email,
    clientPhone:        lead.phoneNumber,
    estimatedBilling:   lead.finalBilling,
    estimatedBudget:    lead.finalBudget,
    clientPaidAmount:   lead.negotiation?.clientPaidAmount ?? 0,

    // ── Fields pre-populated with safe defaults for admin to complete ─────
    // The admin will complete these in the Projects section.
    status:             'ongoing',          // Default project status
    stage:              'kickoff',          // Default stage — admin updates
    assignedWorkers:    [],                 // Admin assigns workers in Projects
    assignedAdmins:     [adminUid],
    startDate:          Timestamp.now(),    // Default to today; admin can edit
    deadline:           null,               // Admin must set this

    // ── Source-of-truth reference back to the originating lead ────────────
    sourceLeadId:       lead.leadId,        // Traceability link

    // ── Metadata ──────────────────────────────────────────────────────────
    createdAt:          serverTimestamp(),
    createdBy:          adminUid,
    updatedAt:          serverTimestamp(),
    isArchived:         false,

    // ── Marker so the Projects section can highlight "new from lead" ──────
    convertedFromLead:  true,
  });

  // ── Step 2: Lock the lead document ────────────────────────────────────────
  const leadRef = doc(db, 'leads', lead.leadId);

  batch.update(leadRef, {
    isConverted:        true,
    convertedProjectId: newProjectRef.id,
    convertedAt:        serverTimestamp(),
    convertedBy:        adminUid,
    updatedAt:          serverTimestamp(),
    updatedBy:          adminUid,
  });

  // ── Step 3: Auto-log the conversion in lead_logs ──────────────────────────
  const logRef = doc(collection(db, 'leads', lead.leadId, 'lead_logs'));

  batch.set(logRef, {
    content:     `Lead converted to project by ${adminName}. Project ID: ${newProjectRef.id}`,
    phase:       'final',
    loggedBy:    adminUid,
    loggerName:  adminName,
    createdAt:   serverTimestamp(),
    attachments: [],
  });

  // ── Commit all three writes atomically ────────────────────────────────────
  await batch.commit();

  return newProjectRef.id;
}
```

---

### 5.3 Field Mapping Reference

| Lead Field | Maps to Project Field | Notes |
|-----------|----------------------|-------|
| `projectTitle` | `title` | Direct copy |
| `description` | `description` | Direct copy |
| `clientName` | `clientName` | Direct copy |
| `email` | `clientEmail` | Direct copy |
| `phoneNumber` | `clientPhone` | Direct copy |
| `finalBilling` | `estimatedBilling` | Locked agreed value |
| `finalBudget` | `estimatedBudget` | Locked budget value |
| `negotiation.clientPaidAmount` | `clientPaidAmount` | Carry over any advance |
| `leadId` | `sourceLeadId` | Traceability |
| *(none)* | `assignedWorkers: []` | Admin fills in Projects section |
| *(none)* | `deadline: null` | Admin fills in Projects section |
| *(none)* | `stage: 'kickoff'` | Admin updates in Projects section |

**Fields intentionally NOT copied:** `category`, `phase`, `negotiation` sub-map, `isDeleted`, `isConverted`, `createdBy` (the project gets its own `createdBy`).

---

### 5.4 Post-Conversion UI Behaviour

After `convertLeadToProject()` resolves successfully:
1. The `onSnapshot` listener on the `leads` collection receives the updated document with `isConverted: true`. The lead card immediately shows the green "✓ Converted" overlay — no manual state update required.
2. A toast notification fires: `"Project created successfully. Complete setup in Projects →"` with a navigation link.
3. The `[Convert to Project]` button in the modal is replaced by `[View Project →]` which navigates to `/projects/${convertedProjectId}`.
4. The `LeadsMetricsBar` "Converted to Project" counter and "Total Profit" recalculate automatically via the `onSnapshot`-driven `useMemo` in `LeadsPage`.

---

## 6. State Management & Hook Design

### 6.1 `useLeads(timeframeFilter)` — Page-Level Hook

**File:** `src/hooks/useLeads.js`

The primary data hook. Owns the main `onSnapshot` listener for the `leads` collection.

```js
export function useLeads(timeframeFilter) {
  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    const { fromDate, toDate } = resolveDateRange(timeframeFilter);

    const q = query(
      collection(db, 'leads'),
      where('isDeleted',  '==', false),
      where('createdAt',  '>=', Timestamp.fromDate(fromDate)),
      where('createdAt',  '<=', Timestamp.fromDate(toDate)),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setLeads(snap.docs.map(d => ({ leadId: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[useLeads]', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [timeframeFilter]); // Re-subscribes whenever the filter changes

  return { leads, loading, error };
}

// Helper: resolve a TimeframeFilter object to { fromDate, toDate } Date objects
function resolveDateRange(filter) {
  const now = new Date();
  if (filter.mode === 'this_month') {
    return {
      fromDate: new Date(now.getFullYear(), now.getMonth(), 1),
      toDate:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    };
  }
  if (filter.mode === 'last_month') {
    return {
      fromDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      toDate:   new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
    };
  }
  if (filter.mode === 'last_3_months') {
    const from = new Date(now);
    from.setMonth(from.getMonth() - 3);
    return { fromDate: from, toDate: now };
  }
  if (filter.mode === 'custom') {
    return { fromDate: filter.fromDate, toDate: filter.toDate };
  }
}
```

---

### 6.2 `useLeadLogs(leadId)` — Modal-Level Hook

**File:** `src/hooks/useLeadLogs.js`

```js
export function useLeadLogs(leadId) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leadId) return;
    const unsub = onSnapshot(
      query(
        collection(db, 'leads', leadId, 'lead_logs'),
        orderBy('createdAt', 'desc')
      ),
      (snap) => {
        setLogs(snap.docs.map(d => ({ logId: d.id, ...d.data() })));
        setLoading(false);
      }
    );
    return () => unsub();
  }, [leadId]);

  return { logs, loading };
}
```

---

### 6.3 `useLeadsMetrics(leads)` — Derived Metrics Hook

**File:** `src/hooks/useLeadsMetrics.js`

A pure computation hook — no Firestore calls. Derives all metrics bar values from the leads array.

```js
export function useLeadsMetrics(leads) {
  return useMemo(() => {
    const active   = leads.filter(l => !l.isDeleted);
    const converted = active.filter(l => l.isConverted);

    return {
      total:            active.length,
      hot:              active.filter(l => l.category === 'hot').length,
      neutral:          active.filter(l => l.category === 'neutral').length,
      cold:             active.filter(l => l.category === 'cold').length,
      convertedCount:   converted.length,
      totalProfit:      converted.reduce((s, l) => s + (l.finalBilling ?? 0), 0),
      pending:          active.filter(l => !l.isConverted && l.phase !== 'failed').length,
      failed:           active.filter(l => l.phase === 'failed').length,
    };
  }, [leads]);
}
```

---

### 6.4 Modal State — `LeadsPage` Level

The selected lead for the detail modal is managed as a piece of state in `LeadsPage`, not in a global context. This avoids prop-drilling while keeping the modal logically close to the data owner.

```js
// LeadsPage.jsx
const [selectedLead, setSelectedLead] = useState(null);  // null = modal closed
const [createDefaultCategory, setCreateDefaultCategory] = useState(null);

const handleLeadClick   = (lead)     => setSelectedLead(lead);
const handleCreateLead  = (category) => setCreateDefaultCategory(category);
const handleCloseModal  = ()         => setSelectedLead(null);
```

When `onSnapshot` delivers an update to a lead that is currently open in the modal, the `leads` array updates, but the modal's `selectedLead` is a stale reference. Fix this with a derived value:

```js
// Always display the most up-to-date version of the selected lead
const activeLead = useMemo(
  () => leads.find(l => l.leadId === selectedLead?.leadId) ?? selectedLead,
  [leads, selectedLead]
);
```

---

## 7. Firebase Query Patterns

### 7.1 Main Leads Query (with time filter)

```js
query(
  collection(db, 'leads'),
  where('isDeleted', '==', false),
  where('createdAt', '>=', Timestamp.fromDate(fromDate)),
  where('createdAt', '<=', Timestamp.fromDate(toDate)),
  orderBy('createdAt', 'desc')
)
// Required composite index: isDeleted ASC + createdAt DESC
```

### 7.2 Converted Leads Only (for metrics)

Metrics are derived from the full `leads` array in memory (`useLeadsMetrics`). Do not issue a separate Firestore query for metrics — use the already-subscribed data.

### 7.3 Lead Logs Subcollection

```js
query(
  collection(db, 'leads', leadId, 'lead_logs'),
  orderBy('createdAt', 'desc')
)
// Single-field index on createdAt — auto-created by Firestore
```

### 7.4 Writing a Phase Change + Auto-Log (non-batch, sequential)

Phase change and auto-log use two sequential `await` writes (not a batch) because the log document does not need to be atomic with the phase update — a partial failure here is recoverable.

```js
await updateDoc(leadRef, { phase: newPhase, updatedAt: serverTimestamp(), updatedBy: uid });
await addDoc(logsCollection, { content: `Phase → ${newPhase}`, ...logFields });
```

If strict atomicity is needed (e.g., compliance requirement), wrap in a `writeBatch`.

### 7.5 Conversion — Atomic Batch (see §5.2)

Always use `writeBatch` for the conversion. Three writes (new project, lead update, auto-log) must all succeed or all fail.

---

## 8. Security Rules Additions

Append to `firestore.rules`. Do not modify existing rules.

```javascript
// ── leads collection ────────────────────────────────────────────────────────
match /leads/{leadId} {

  // Only admins and super_admins can read leads.
  allow read: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ['admin', 'super_admin'];

  // Only admins can create leads.
  allow create: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ['admin', 'super_admin'] &&
    request.resource.data.phase      == 'initial' &&
    request.resource.data.isConverted == false     &&
    request.resource.data.isDeleted   == false;

  // Only admins can update leads.
  // Enforce: category is immutable after creation.
  allow update: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ['admin', 'super_admin'] &&
    // Category cannot be changed
    request.resource.data.category == resource.data.category;

  // Hard deletes are forbidden. Soft delete (isDeleted: true) is handled via update.
  allow delete: if false;

  // ── lead_logs subcollection ────────────────────────────────────────────────
  match /lead_logs/{logId} {

    // Only admins can read logs.
    allow read: if request.auth != null &&
      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
        in ['admin', 'super_admin'];

    // Only admins can create logs. Logs are append-only.
    allow create: if request.auth != null &&
      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
        in ['admin', 'super_admin'];

    // Logs are immutable once written.
    allow update, delete: if false;
  }
}
```

---

## 9. Component Tree Reference

```
<LeadsPage />                                  src/pages/Leads/LeadsPage.jsx
  │  owns: useLeads(timeframeFilter)
  │  owns: useLeadsMetrics(leads)
  │  owns: selectedLead state, createDefaultCategory state
  │
  ├── <LeadsMetricsBar />                      src/pages/Leads/LeadsMetricsBar.jsx
  │     Props: leads[]
  │     Displays: total, hot/neutral/cold counts, converted count, total profit (₹)
  │
  ├── <LeadsTimeFilter />                      src/pages/Leads/LeadsTimeFilter.jsx
  │     Props: value, onChange
  │     Controls: this_month | last_month | last_3_months | custom date range
  │
  ├── <LeadsKanbanBoard />                     src/pages/Leads/LeadsKanbanBoard.jsx
  │     Props: leads[], onLeadClick, onCreateLead
  │     │
  │     ├── <LeadsColumn category="hot" />
  │     │     └── <LeadCard /> × N             src/components/leads/LeadCard.jsx
  │     ├── <LeadsColumn category="neutral" />
  │     │     └── <LeadCard /> × N
  │     └── <LeadsColumn category="cold" />
  │           └── <LeadCard /> × N
  │
  ├── <CreateLeadModal />                      src/components/leads/CreateLeadModal.jsx
  │     Triggered: onCreateLead(category)
  │     Writes: addDoc to leads collection
  │
  └── <LeadDetailModal />                      src/components/leads/LeadDetailModal.jsx
        Triggered: onLeadClick(lead)
        owns: useLeadLogs(leadId)
        owns: activeTab state ('overview' | 'logs' | 'financials')
        │
        ├── Tab: Overview
        │     └── <LeadOverviewPanel />        src/components/leads/LeadOverviewPanel.jsx
        │           Inline edit mode for non-financial, non-category fields
        │
        ├── Tab: Logs
        │     └── <LeadLogsPanel />            src/components/leads/LeadLogsPanel.jsx
        │           Add log form + chronological log list
        │
        ├── Tab: Financials
        │     └── <LeadFinancialsPanel />      src/components/leads/LeadFinancialsPanel.jsx
        │           Renders per-phase: read-only | negotiation form | final summary
        │
        ├── Footer Left:
        │     └── <LeadPhaseSelector />        src/components/leads/LeadPhaseSelector.jsx
        │           Phase stepper with transition validation
        │
        └── Footer Right: [Conditional Action Buttons]
              ├── [Edit Lead Info]             → enables edit mode in Overview tab
              ├── [Convert to Project]         → phase === 'final' && !isConverted
              │     └── <ConvertToProjectConfirmModal />
              │           Calls: convertLeadToProject() from leadsService.js
              ├── [View Project →]             → isConverted === true
              └── [🗑 Delete Lead]             → phase === 'failed' only
```

**Shared/Utility components** (`src/components/leads/`):

| Component | Purpose |
|-----------|---------|
| `<LeadCategoryBadge category />` | Colored pill: HOT / NEUTRAL / COLD |
| `<LeadPhaseBadge phase />` | Colored pill: INITIAL / NEGOTIATION / FINAL / FAILED |
| `<LeadSourceTag source />` | Small grey pill for lead source |
| `<LeadSkeletonCard />` | Shimmer loading placeholder for kanban columns |
| `<EmptyColumnState category />` | Zero-state graphic when a column has no leads |
| `<ConvertToProjectConfirmModal />` | Confirmation dialog before conversion batch write |
