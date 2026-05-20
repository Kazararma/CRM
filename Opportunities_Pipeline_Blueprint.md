# Opportunities Pipeline — Developer Blueprint
### CRM · Leads Module Refactor + New Opportunities Module
#### React 18 + Vite + Tailwind CSS + Lucide React + Firebase Firestore

> **Document Authority:** This blueprint governs two parallel workstreams: (1) a non-destructive refactor of the existing Leads module, and (2) the net-new Opportunities module that sits between Leads and Projects in the CRM pipeline. Implement workstream 1 fully before starting workstream 2. All Firestore writes must be non-destructive — no existing document fields are deleted or renamed in place.

---

## Table of Contents
1. [Pipeline Architecture Overview](#1-pipeline-architecture-overview)
2. [Leads Module Refactor — Schema & UI](#2-leads-module-refactor--schema--ui)
3. [Opportunities Module — Firestore Schema](#3-opportunities-module--firestore-schema)
4. [Opportunities Module — UI & Component Architecture](#4-opportunities-module--ui--component-architecture)
5. [The Two Conversion Handshakes](#5-the-two-conversion-handshakes)
6. [State Management & Hook Design](#6-state-management--hook-design)
7. [Security Rules Additions](#7-security-rules-additions)
8. [Component Tree Reference](#8-component-tree-reference)

---

## 1. Pipeline Architecture Overview

### 1.1 The Three-Stage CRM Pipeline

```
  ┌──────────────┐     Handshake 1      ┌─────────────────┐     Handshake 2     ┌──────────────┐
  │    LEADS     │  ─────────────────►  │  OPPORTUNITIES  │  ─────────────────► │   PROJECTS   │
  │              │  Lead phase:         │                 │  Opportunity phase:  │              │
  │  Hot         │  "qualified"         │  Hot            │  "closed_won"        │  (existing)  │
  │  Neutral     │  → "Convert to       │  Neutral        │  → "Convert to       │              │
  │  Cold        │    Opportunity"      │  Cold           │    Project"          │              │
  └──────────────┘                      └─────────────────┘                      └──────────────┘
```

### 1.2 Data Flow & Inheritance

Each record carries a traceability chain:
```
Lead (leadId)
  └─► Opportunity (opportunityId, sourceLeadId)
        └─► Project (projectId, sourceOpportunityId, sourceLeadId)
```

No data is deleted during a handshake. Source records are locked (`isConverted: true`) and remain in their collection for historical reference.

### 1.3 Visibility Rule
Both Leads and Opportunities sections are **exclusively visible to `admin` and `super_admin` roles**. Route-level guards must redirect workers before any data is fetched.

---

## 2. Leads Module Refactor — Schema & UI

> **Safety-first principle:** Firestore documents are never migrated in bulk. Instead, the frontend normalizes legacy phase names at read time using a mapping function. Old documents remain untouched. New documents are written with new phase names only.

---

### 2.1 Phase Renaming — Legacy Compatibility Layer

#### Mapping Table

| Old Phase Value (Firestore) | New Phase Value (Firestore) | Display Label |
|---|---|---|
| `"initial"` | `"open"` | Open |
| `"negotiation"` | `"contacted"` | Contacted |
| `"final"` | `"qualified"` | Qualified |
| `"failed"` | `"unqualified"` | Unqualified |

#### Normalization Utility

Create this utility **before** touching any component. Every component that consumes a lead's `phase` field must pipe it through this function:

```js
// src/utils/leadPhaseNormalizer.js

/**
 * Normalizes a lead phase value from legacy to current naming.
 * Called at read time on every lead document — never writes to Firestore.
 *
 * @param {string} phase - Raw phase value from Firestore
 * @returns {string}     - Normalized phase value
 */
export const PHASE_LEGACY_MAP = {
  initial:     'open',
  negotiation: 'contacted',
  final:       'qualified',
  failed:      'unqualified',
};

export function normalizeLeadPhase(phase) {
  return PHASE_LEGACY_MAP[phase] ?? phase;
  // If the phase is already new (e.g. "open"), the map returns undefined
  // and we fall through to the original value — safe for both old and new docs.
}

/**
 * Apply normalization to a full lead document object.
 * Use this in onSnapshot handlers before setting state.
 */
export function normalizeLead(leadDoc) {
  return {
    ...leadDoc,
    phase: normalizeLeadPhase(leadDoc.phase),
  };
}
```

#### Where to Apply Normalization

Apply `normalizeLead()` in exactly **one** place: inside the `onSnapshot` callback in `useLeads.js`, before `setLeads()` is called. This ensures every component downstream always receives normalized data.

```js
// src/hooks/useLeads.js — onSnapshot handler
const unsub = onSnapshot(q, (snap) => {
  setLeads(snap.docs.map(d => normalizeLead({ leadId: d.id, ...d.data() })));
});
```

#### Writing New Phases

All new lead documents and all phase-update writes must use the **new** phase values (`"open"`, `"contacted"`, `"qualified"`, `"unqualified"`). Never write old phase names.

```js
// Phase selector write — always uses new naming
await updateDoc(leadRef, { phase: 'contacted' }); // ✅
await updateDoc(leadRef, { phase: 'negotiation' }); // ❌ Never write old names
```

---

### 2.2 Leads Firestore Schema — Additive Changes

The following fields are **added** to new lead documents. Legacy documents without these fields will render gracefully (treat missing fields as empty/null).

**Fields removed from new lead creation forms (but kept in Firestore for legacy docs):**
- `estimatedBilling`, `estimatedBudget`, `negotiation{}`, `finalBilling`, `finalBudget`

These legacy fields must never be written to new documents. They remain readable on old documents for historical display but are not editable.

**New fields added to the `leads` schema:**

```
leads/{leadId}
  │
  ├── [ALL EXISTING FIELDS — unchanged and still written]
  │
  ├── // ── New: Contacted Info (replaces negotiation financials) ──────────────
  ├── contactedInfo: {
  │     productDescription:  string      // Description of product/service discussed
  │     modeOfContact:       string      // "call" | "email" | "meeting" | "other"
  │     contactDate:         Timestamp   // Date of the contact event
  │     endOutcome:          string      // Free text: what happened at end of contact
  │   }
  │
  ├── // ── New: Conversion tracking to Opportunity (replaces project conversion) ──
  ├── isConvertedToOpportunity:  boolean     // false by default
  ├── convertedOpportunityId:    string | null
  ├── convertedToOpportunityAt:  Timestamp | null
  ├── convertedToOpportunityBy:  string | null  // admin uid
  │
  └── // ── Legacy field that must now be treated as deprecated ──────────────
      // isConverted / convertedProjectId — still readable, never written to new docs
      // If a legacy lead has isConverted: true, it converted directly to a project
      // under the old system. Render a "Converted to Project (Legacy)" badge.
```

---

### 2.3 Leads Phase Lifecycle — Updated Rules

```
[open] ──────────────────────────────────► [contacted]
  │                                              │
  └──────────────► [unqualified]◄───────────────┘
                                                 │
                                                 ▼
                                           [qualified]
                                                 │
                                  isConvertedToOpportunity: false
                                                 │
                                                 ▼
                                    [Convert to Opportunity button]
```

**Transition rules (enforced in `<LeadPhaseSelector />`):**
- `open` → `contacted`, `unqualified`
- `contacted` → `qualified`, `unqualified`
- `qualified` → no further phase changes (terminal pending conversion)
- `unqualified` → terminal (delete only)
- Converted leads (`isConvertedToOpportunity: true`) → read-only, no transitions

---

### 2.4 Leads UI Changes — Detail Modal

#### 2.4.1 Remove From Modal
The following UI sections are **removed** from `<LeadDetailModal />` and its child components:
- The entire "Financials" tab (`<LeadFinancialsPanel />`)
- All inputs: `estimatedBilling`, `estimatedBudget`, `askedFromClient`, `clientAgreedOn`, `clientPaidAmount`
- `<ConvertToProjectConfirmModal />` and its trigger button

The tab bar now has two tabs only: **Overview** and **Logs**.

#### 2.4.2 Add to Modal — "Contacted Info" Section

Add a "Contacted Info" card inside the **Overview tab**, rendered below the main contact details. It is hidden when `lead.phase === 'open'` (there's nothing to show yet).

When `lead.phase === 'contacted'`, `'qualified'`, or `'unqualified'`, this card appears with editable fields (except for `qualified` with `isConvertedToOpportunity: true` — read-only).

**`<ContactedInfoCard />` — `src/components/leads/ContactedInfoCard.jsx`**

Fields:
```
┌─────────────────────────────────────────────────────┐
│  Contacted Info                                      │
│─────────────────────────────────────────────────────│
│  Product / Info Described:  [textarea]               │
│  Mode of Contact:           [dropdown]               │
│                              call | email |          │
│                              meeting | other         │
│  Date of Contact:           [date picker]            │
│  End Outcome:               [textarea]               │
│─────────────────────────────────────────────────────│
│                              [Save Contacted Info]   │
└─────────────────────────────────────────────────────┘
```

**Save write:**
```js
await updateDoc(doc(db, 'leads', leadId), {
  'contactedInfo.productDescription': formData.productDescription,
  'contactedInfo.modeOfContact':      formData.modeOfContact,
  'contactedInfo.contactDate':        Timestamp.fromDate(new Date(formData.contactDate)),
  'contactedInfo.endOutcome':         formData.endOutcome,
  updatedAt:                          serverTimestamp(),
  updatedBy:                          currentUser.uid,
});
```

#### 2.4.3 Replace "Convert to Project" → "Convert to Opportunity"

In the modal footer, when `lead.phase === 'qualified'` and `lead.isConvertedToOpportunity === false`:

```
Footer Right:
  [Convert to Opportunity →]   ← replaces old "Convert to Project" button
```

Clicking this button opens `<ConvertToOpportunityConfirmModal />` (see §5.1).

When `lead.isConvertedToOpportunity === true`:
```
Footer Right:
  [View Opportunity →]   ← navigates to /opportunities filtered to this opportunity
```

#### 2.4.4 Unqualified Phase — Delete Button

When `lead.phase === 'unqualified'`, the footer right shows:
```
Footer Right:
  [🗑 Delete Lead]   ← soft delete, same isDeleted: true pattern as before
```

This is the **only** phase that exposes the delete button. The implementation is identical to the prior `"failed"` phase delete logic.

---

### 2.5 Updated `<LeadPhaseSelector />` — Display Labels

Update the component to use new display labels while keeping the underlying Firestore values as the new phase names:

```js
// src/components/leads/LeadPhaseSelector.jsx
export const LEAD_PHASES = [
  { value: 'open',         label: 'Open',         color: 'gray'   },
  { value: 'contacted',    label: 'Contacted',    color: 'blue'   },
  { value: 'qualified',    label: 'Qualified',    color: 'green'  },
  { value: 'unqualified',  label: 'Unqualified',  color: 'red'    },
];

// Allowed transitions map
export const LEAD_PHASE_TRANSITIONS = {
  open:         ['contacted', 'unqualified'],
  contacted:    ['qualified', 'unqualified'],
  qualified:    [],   // Terminal — conversion handled by handshake button
  unqualified:  [],   // Terminal — delete only
};
```

---

## 3. Opportunities Module — Firestore Schema

### 3.1 `opportunities` Collection — `opportunities/{opportunityId}`

```
opportunities/{opportunityId}
  │
  ├── // ── Identity & Traceability ─────────────────────────────────────────
  ├── opportunityId:       string      // Auto-generated Firestore document ID
  ├── sourceLeadId:        string      // leadId of the originating qualified lead
  ├── title:               string      // Inherited from lead.projectTitle
  ├── clientName:          string      // Inherited from lead.clientName
  ├── clientEmail:         string      // Inherited from lead.email
  ├── clientPhone:         string      // Inherited from lead.phoneNumber
  ├── source:              string      // Inherited from lead.source
  │
  ├── // ── Classification (inherited from lead, immutable) ─────────────────
  ├── category:            string      // "hot" | "neutral" | "cold" — from lead
  │
  ├── // ── Pipeline Phase ───────────────────────────────────────────────────
  ├── phase:               string      // See §3.2 for all 10 phase values
  │                                   // Default: "prospecting"
  │
  ├── // ── Contacted Info (carried from the qualified lead) ─────────────────
  ├── contactedInfo: {
  │     productDescription:  string
  │     modeOfContact:       string
  │     contactDate:         Timestamp
  │     endOutcome:          string
  │   }
  │
  ├── // ── Phase 1: Prospecting ─────────────────────────────────────────────
  ├── prospecting: {
  │     hasPotentialDeal:    boolean | null   // null = not yet answered
  │   }
  │
  ├── // ── Phase 2: Qualification ───────────────────────────────────────────
  ├── qualification: {
  │     projectTitle:        string
  │     projectBrief:        string      // Short brief / scope summary
  │     estimatedBudget:     number      // ₹
  │   }
  │
  ├── // ── Phase 3: Needs Analysis ──────────────────────────────────────────
  ├── needsAnalysis: {
  │     detailedProjectDetails:  string  // Rich text / long-form description
  │     estimatedCosts:          number  // ₹ — internal cost estimate
  │     painPoints:              string  // What problems the client needs solved
  │   }
  │
  ├── // ── Phase 4: Value Proposition ───────────────────────────────────────
  ├── valueProposition: {
  │     presentationNotes:   string      // How our solution maps to their project details
  │     keyValuePoints:      string[]    // Array of bullet-point value statements
  │   }
  │
  ├── // ── Phase 5: Decision Makers ─────────────────────────────────────────
  ├── decisionMakers: {
  │     assignedAdminIds:    string[]    // Array of admin uids assigned to this deal
  │     assignedAdminNames:  string[]    // Denormalized for display
  │     stakeholderNotes:    string      // Notes on key client stakeholders
  │   }
  │
  ├── // ── Phase 6: Perception Analysis ─────────────────────────────────────
  ├── perceptionAnalysis: {
  │     comparisonRows:  array of {
  │       criterion:     string          // e.g. "Pricing", "Support", "Delivery Time"
  │       ourValue:      string          // Our position on this criterion
  │       competitorValue: string        // Competitor's position
  │     }
  │     overallNotes:    string
  │   }
  │
  ├── // ── Phase 7: Proposal / Price Quote ──────────────────────────────────
  ├── proposal: {
  │     moneyAskedFromClient:  number    // ₹ — formal bid amount
  │     initialPaymentAmount:  number    // ₹ — upfront payment requested
  │     contractStartDate:     Timestamp
  │     contractEndDate:       Timestamp
  │     contractTermsDetails:  string    // Key contract clauses / terms
  │     proposalDocumentUrl:   string | null   // Optional uploaded doc link
  │   }
  │
  ├── // ── Phase 8: Negotiation / Review ────────────────────────────────────
  ├── negotiationReview: {
  │     moneyAgreedByClient:          number  // ₹ — final agreed total
  │     initialPaymentAgreedByClient: number  // ₹ — agreed upfront amount
  │     negotiationNotes:             string
  │   }
  │
  ├── // ── Phase 9: Closed Won (Terminal — success) ──────────────────────────
  ├── closedWon: {
  │     isConvertedToProject:  boolean     // false until handshake
  │     convertedProjectId:    string | null
  │     convertedAt:           Timestamp | null
  │     convertedBy:           string | null   // admin uid
  │   }
  │
  ├── // ── Phase 10: Closed Lost (Terminal — failure) ───────────────────────
  ├── closedLost: {
  │     lostReason:   string      // Why the deal was lost
  │     lostDate:     Timestamp
  │   }
  │
  ├── // ── Soft Delete ───────────────────────────────────────────────────────
  ├── isDeleted:           boolean     // false; only set true from Closed Lost
  │
  ├── // ── Metadata ─────────────────────────────────────────────────────────
  ├── createdAt:           Timestamp
  ├── createdBy:           string      // admin uid who triggered Lead → Opportunity
  ├── updatedAt:           Timestamp
  └── updatedBy:           string
```

---

### 3.2 The 10 Opportunity Phases — Master Reference

| # | Phase Value (Firestore) | Display Label | Terminal? |
|---|------------------------|---------------|-----------|
| 1 | `"prospecting"` | Prospecting | No |
| 2 | `"qualification"` | Qualification | No |
| 3 | `"needs_analysis"` | Needs Analysis | No |
| 4 | `"value_proposition"` | Value Proposition | No |
| 5 | `"decision_makers"` | Decision Makers | No |
| 6 | `"perception_analysis"` | Perception Analysis | No |
| 7 | `"proposal"` | Proposal / Price Quote | No |
| 8 | `"negotiation_review"` | Negotiation & Review | No |
| 9 | `"closed_won"` | Closed Won | Yes ✅ |
| 10 | `"closed_lost"` | Closed Lost | Yes ❌ |

**Transition rule:** Phases progress strictly forward (1 → 2 → 3 ... → 8), after which the opportunity is marked either `"closed_won"` or `"closed_lost"`. No backward transitions are permitted in the UI. From any non-terminal phase, the admin may jump directly to `"closed_lost"`.

---

### 3.3 `opportunity_logs` Subcollection — `opportunities/{opportunityId}/opportunity_logs/{logId}`

Identical structure to `lead_logs` — adapted for opportunities:

```
opportunities/{opportunityId}/opportunity_logs/{logId}
  ├── logId:         string
  ├── content:       string      // Log note content
  ├── phase:         string      // Phase snapshot at time of logging
  ├── loggedBy:      string      // admin uid
  ├── loggerName:    string      // Denormalized
  ├── createdAt:     Timestamp
  └── attachments:   string[]    // Firebase Storage download URLs; default []
```

Phase changes are **auto-logged** (same pattern as leads). Admins can also add manual log entries at any time.

---

### 3.4 Required Firestore Indexes — `firestore.indexes.json`

```json
[
  {
    "collectionGroup": "opportunities",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted",  "order": "ASCENDING" },
      { "fieldPath": "category",   "order": "ASCENDING" },
      { "fieldPath": "createdAt",  "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "opportunities",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted",  "order": "ASCENDING" },
      { "fieldPath": "phase",      "order": "ASCENDING" },
      { "fieldPath": "createdAt",  "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "opportunity_logs",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "createdAt",  "order": "DESCENDING" }
    ]
  }
]
```

---

## 4. Opportunities Module — UI & Component Architecture

### 4.1 Route & Page Entry

**Route:** `/opportunities`
**Guard:** Admin/super_admin only — redirect workers.
**Top-level component:** `src/pages/Opportunities/OpportunitiesPage.jsx`

`OpportunitiesPage` is structurally identical to `LeadsPage`:
- Owns the global `onSnapshot` on `opportunities` (filtered by `isDeleted: false` and time filter).
- Renders `<OpportunitiesMetricsBar />`, `<LeadsTimeFilter />` (reused), and `<OpportunitiesKanbanBoard />`.

---

### 4.2 `<OpportunitiesMetricsBar />`

**File:** `src/pages/Opportunities/OpportunitiesMetricsBar.jsx`

| Metric | Derivation |
|--------|-----------|
| Total Opportunities | `opps.length` |
| Hot / Neutral / Cold | Count per category |
| Closed Won | `opps.filter(o => o.phase === 'closed_won').length` |
| Converted to Project | `opps.filter(o => o.closedWon?.isConvertedToProject).length` |
| Closed Lost | `opps.filter(o => o.phase === 'closed_lost').length` |
| Total Pipeline Value | Sum of `negotiationReview.moneyAgreedByClient` (or `proposal.moneyAskedFromClient` if negotiation not yet filled) across all non-lost opportunities |

---

### 4.3 `<OpportunitiesKanbanBoard />`

**File:** `src/pages/Opportunities/OpportunitiesKanbanBoard.jsx`

Three-column layout: Hot | Neutral | Cold — identical structure to `<LeadsKanbanBoard />`. Each column renders `<OpportunityCard />` components.

The "+ Create Opportunity" entry point does **not** exist here. Opportunities are created exclusively via the Lead → Opportunity handshake (§5.1). The column headers show the count but have no create button. Instead, a muted caption reads: "Opportunities are created from qualified Leads."

---

### 4.4 `<OpportunityCard />`

**File:** `src/components/opportunities/OpportunityCard.jsx`

```
┌────────────────────────────────────────┐
│ [Category Badge]  [Phase Pill]          │
│ [Project Title]                         │
│ Client: [clientName]                    │
│ Phase: [Prospecting → ... → Closed Won] │
│ Pipeline Value: ₹[moneyAgreed or asked] │
│ [createdAt]            [Source badge]   │
│ if closed_won + converted: ✓ Converted  │
└────────────────────────────────────────┘
```

Phase pill color progression:
- Phases 1–2: grey
- Phases 3–5: blue
- Phases 6–8: amber
- `closed_won`: green
- `closed_lost`: red (card is dimmed overall)

---

### 4.5 `<OpportunityDetailModal />` — The Dynamic 10-Stage Modal

**File:** `src/components/opportunities/OpportunityDetailModal.jsx`

This is the most complex component in the module. The core design challenge is presenting 10 phases of data without overwhelming the admin. The solution is a **Vertical Stage Navigator** (left sidebar) combined with a **single active stage content pane** (right).

---

#### 4.5.1 Layout Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Category Badge]  [Opportunity Title]              [Phase Pill]      │
│  Client: [name]  |  Source: [source]  |  Created: [date]             │
│──────────────────────────────────────────────────────────────────────│
│                                                                        │
│  ┌──────────────────────┐  ┌──────────────────────────────────────┐   │
│  │  STAGE NAVIGATOR     │  │  ACTIVE STAGE CONTENT PANE           │   │
│  │  (left, fixed width) │  │  (right, scrollable)                 │   │
│  │──────────────────────│  │──────────────────────────────────────│   │
│  │  ● Prospecting       │  │  [Stage-specific input fields]       │   │
│  │  ○ Qualification     │  │                                      │   │
│  │  ○ Needs Analysis    │  │  [Save Stage Data] button            │   │
│  │  ○ Value Proposition │  │                                      │   │
│  │  ○ Decision Makers   │  │──────────────────────────────────────│   │
│  │  ○ Perception Anlys  │  │  LOGS PANEL (collapsible, bottom)    │   │
│  │  ○ Proposal          │  │  [Add log] + chronological list      │   │
│  │  ○ Negotiation       │  └──────────────────────────────────────┘   │
│  │  ─────────────────   │                                             │
│  │  ✓ Closed Won        │                                             │
│  │  ✗ Closed Lost       │                                             │
│  └──────────────────────┘                                             │
│──────────────────────────────────────────────────────────────────────│
│  [Phase Advance Button]                   [Footer Action Buttons]     │
└──────────────────────────────────────────────────────────────────────┘
```

---

#### 4.5.2 Stage Navigator Behaviour

**File:** `src/components/opportunities/OpportunityStageNavigator.jsx`

```js
// Props
interface StageNavigatorProps {
  currentPhase: string;          // The opportunity's live Firestore phase
  viewingPhase: string;          // Which stage's content pane is currently displayed
  onStageSelect: (phase: string) => void;
}
```

**Key rules:**
- **Completed stages** (phase index < current phase index): rendered with a ✓ checkmark, clickable — admin can view/edit past stage data.
- **Current active stage**: highlighted (bold, blue left border), clickable.
- **Future stages** (phase index > current): rendered with ○ bullet, clickable for **viewing only** — the content pane renders in read-only mode with a note: "This stage is not yet active."
- `Closed Won` and `Closed Lost` are always at the bottom, separated by a divider.

**`viewingPhase` vs `currentPhase`:**
The modal maintains a local `viewingPhase` state, separate from the opportunity's Firestore `phase`. This allows the admin to click back to review Prospecting data while the opportunity is in the Proposal stage. The content pane reads from `viewingPhase`; the Firestore write buttons are enabled only when `viewingPhase === currentPhase`.

```js
// OpportunityDetailModal.jsx local state
const [viewingPhase, setViewingPhase] = useState(opportunity.phase);
```

---

#### 4.5.3 Stage Content Pane — `<StageContentPane />`

**File:** `src/components/opportunities/StageContentPane.jsx`

A single component that renders the correct form based on `viewingPhase`. Uses a `switch` statement or a stage registry:

```js
// src/components/opportunities/stages/index.js — Stage Registry Pattern
export const STAGE_COMPONENTS = {
  prospecting:         ProspectingStage,
  qualification:       QualificationStage,
  needs_analysis:      NeedsAnalysisStage,
  value_proposition:   ValuePropositionStage,
  decision_makers:     DecisionMakersStage,
  perception_analysis: PerceptionAnalysisStage,
  proposal:            ProposalStage,
  negotiation_review:  NegotiationReviewStage,
  closed_won:          ClosedWonStage,
  closed_lost:         ClosedLostStage,
};
```

Each stage component (`src/components/opportunities/stages/*.jsx`) receives:

```ts
interface StageProps {
  opportunity: OpportunityDocument;  // Full live opportunity data
  isReadOnly: boolean;               // true when viewingPhase !== currentPhase
  onSave: (stageData: object) => Promise<void>;
}
```

---

#### 4.5.4 Individual Stage Component Specifications

Each stage component maps to one phase data sub-map in Firestore. Below is the field specification for each.

---

**Stage 1 — `<ProspectingStage />`** (`src/components/opportunities/stages/ProspectingStage.jsx`)

```
UI: A prominent Yes/No toggle or two large radio buttons.
    "Is there a potential deal?"
    
    [  YES — Potential Deal  ]   [  NO — Not Promising  ]

Saves to: opportunity.prospecting.hasPotentialDeal (boolean)

Note: The opportunity remains in "prospecting" phase regardless of the answer.
      The answer is informational for the admin. Phase advance is manual.
```

---

**Stage 2 — `<QualificationStage />`** (`src/components/opportunities/stages/QualificationStage.jsx`)

```
Fields:
  Project Title:   [text input]           → qualification.projectTitle
  Project Brief:   [textarea]             → qualification.projectBrief
  Budget (₹):      [number input]         → qualification.estimatedBudget
```

---

**Stage 3 — `<NeedsAnalysisStage />`** (`src/components/opportunities/stages/NeedsAnalysisStage.jsx`)

```
Fields:
  Detailed Project Details:  [large textarea]  → needsAnalysis.detailedProjectDetails
  Estimated Internal Costs (₹): [number]       → needsAnalysis.estimatedCosts
  Client Pain Points:        [textarea]         → needsAnalysis.painPoints
```

---

**Stage 4 — `<ValuePropositionStage />`** (`src/components/opportunities/stages/ValuePropositionStage.jsx`)

```
Context display (read-only reference):
  "Project Details (from Needs Analysis):" [needsAnalysis.detailedProjectDetails rendered]
  "Estimated Cost:" [formatINR(needsAnalysis.estimatedCosts)]

Fields:
  Presentation Notes: [large textarea]    → valueProposition.presentationNotes
  Key Value Points:   [dynamic list]      → valueProposition.keyValuePoints (string[])
                      [+ Add Point] button adds a new text input row
                      Each row has a remove (×) button
```

---

**Stage 5 — `<DecisionMakersStage />`** (`src/components/opportunities/stages/DecisionMakersStage.jsx`)

```
Fields:
  Assigned Admins:  [multi-select dropdown]
                    Fetches users collection where role in ['admin','super_admin']
                    Saves: decisionMakers.assignedAdminIds (string[])
                           decisionMakers.assignedAdminNames (string[]) — denormalized
                           
  Stakeholder Notes: [textarea]            → decisionMakers.stakeholderNotes
```

---

**Stage 6 — `<PerceptionAnalysisStage />`** (`src/components/opportunities/stages/PerceptionAnalysisStage.jsx`)

```
A dynamic comparison table. Columns: Criterion | Us | Competitor

[+ Add Row] button appends a new row to perceptionAnalysis.comparisonRows

Each row:
  Criterion:        [text input]
  Our Value:        [text input]
  Competitor Value: [text input]
  [Remove Row ×]

Below the table:
  Overall Notes:   [textarea]             → perceptionAnalysis.overallNotes

Saves entire comparisonRows array on each save (replace, not merge).
```

---

**Stage 7 — `<ProposalStage />`** (`src/components/opportunities/stages/ProposalStage.jsx`)

```
Fields:
  Money Asked from Client (₹): [number]   → proposal.moneyAskedFromClient
  Initial Payment Amount (₹):  [number]   → proposal.initialPaymentAmount
  Contract Start Date:         [date]     → proposal.contractStartDate (Timestamp)
  Contract End Date:           [date]     → proposal.contractEndDate (Timestamp)
  Contract Terms / Details:    [textarea] → proposal.contractTermsDetails
  Proposal Document:           [file upload → Firebase Storage] → proposal.proposalDocumentUrl
```

---

**Stage 8 — `<NegotiationReviewStage />`** (`src/components/opportunities/stages/NegotiationReviewStage.jsx`)

```
Context display (read-only reference from Proposal stage):
  "Money Asked:"    [formatINR(proposal.moneyAskedFromClient)]
  "Initial Payment Asked:" [formatINR(proposal.initialPaymentAmount)]

Fields:
  Money Agreed by Client (₹): [number]    → negotiationReview.moneyAgreedByClient
  Initial Payment Agreed (₹): [number]    → negotiationReview.initialPaymentAgreedByClient
  Negotiation Notes:          [textarea]  → negotiationReview.negotiationNotes
```

---

**Stage 9 — `<ClosedWonStage />`** (`src/components/opportunities/stages/ClosedWonStage.jsx`)

```
Display: A success state panel showing a summary of the deal:
  - Client Name
  - Final Agreed Amount: formatINR(negotiationReview.moneyAgreedByClient)
  - Initial Payment: formatINR(negotiationReview.initialPaymentAgreedByClient)
  - Contract Period: [contractStartDate] → [contractEndDate]

Action:
  If closedWon.isConvertedToProject === false:
    [🏆 Convert to Project]  ← large, prominent green button
    Opens <ConvertToProjectConfirmModal />

  If closedWon.isConvertedToProject === true:
    [✓ Converted to Project]  — disabled, success state
    [View Project →]          — navigates to /projects/{convertedProjectId}
```

---

**Stage 10 — `<ClosedLostStage />`** (`src/components/opportunities/stages/ClosedLostStage.jsx`)

```
Fields (shown before the opportunity is deleted):
  Reason for Loss:  [textarea]            → closedLost.lostReason
  Date:             [auto: serverTimestamp] → closedLost.lostDate

Action:
  [🗑 Delete Opportunity]  ← soft delete (isDeleted: true), shown only here
  Requires confirmation dialog before executing.
```

---

#### 4.5.5 Phase Advance Button (Modal Footer Left)

```
[← Previous Stage]   [Mark as Closed Lost]   [Advance to [Next Stage Name] →]
```

Rules:
- "← Previous Stage" navigates `viewingPhase` backward (local state only — does NOT change Firestore phase).
- "Advance to [Next Stage] →" updates Firestore `phase` to the next stage value, auto-logs the transition, and sets `viewingPhase` to the new phase.
- From phase 8 (`negotiation_review`), the advance button becomes two choices: "Closed Won" and "Closed Lost".
- On `closed_won` or `closed_lost`, this button disappears (terminal).

Phase advance write:
```js
const handlePhaseAdvance = async (newPhase) => {
  await updateDoc(doc(db, 'opportunities', opportunityId), {
    phase:     newPhase,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });
  await addDoc(
    collection(db, 'opportunities', opportunityId, 'opportunity_logs'),
    {
      content:    `Phase advanced to "${PHASE_DISPLAY_LABELS[newPhase]}" by ${currentUser.displayName}.`,
      phase:      newPhase,
      loggedBy:   currentUser.uid,
      loggerName: currentUser.displayName,
      createdAt:  serverTimestamp(),
      attachments: [],
    }
  );
};
```

---

## 5. The Two Conversion Handshakes

### 5.1 Handshake 1 — Lead → Opportunity

**Trigger:** Admin clicks "Convert to Opportunity" from a `qualified` lead's modal.
**File:** `src/services/opportunitiesService.js`

#### Confirmation Modal — `<ConvertToOpportunityConfirmModal />`

```
"Convert '[Lead Title]' to an Opportunity?"

  Category:  [Hot / Neutral / Cold badge]
  Client:    [clientName]
  Contact:   [email] | [phone]

  This lead will be locked and an Opportunity will be created.
  You can continue building out the deal in the Opportunities section.

  [Cancel]           [Confirm & Convert →]
```

#### Batch Write Implementation

```js
/**
 * Handshake 1: Converts a qualified Lead into a new Opportunity document.
 * Atomic writeBatch — all three writes succeed or all fail.
 *
 * @param {LeadDocument} lead       - The full qualified lead object
 * @param {string}       adminUid
 * @param {string}       adminName
 * @returns {Promise<string>}       - New opportunityId
 */
export async function convertLeadToOpportunity(lead, adminUid, adminName) {
  const batch = writeBatch(db);

  // ── Write 1: Create the new Opportunity document ────────────────────────
  const newOppRef = doc(collection(db, 'opportunities'));

  batch.set(newOppRef, {
    opportunityId:    newOppRef.id,

    // ── Inherited from Lead ──────────────────────────────────────────────
    sourceLeadId:     lead.leadId,
    title:            lead.projectTitle,
    clientName:       lead.clientName,
    clientEmail:      lead.email,
    clientPhone:      lead.phoneNumber,
    source:           lead.source,
    category:         lead.category,         // hot / neutral / cold — immutable

    // ── Carried Contacted Info ────────────────────────────────────────────
    contactedInfo:    lead.contactedInfo ?? {
      productDescription: '',
      modeOfContact:      '',
      contactDate:        null,
      endOutcome:         '',
    },

    // ── Pipeline Phase ────────────────────────────────────────────────────
    phase:            'prospecting',          // Always starts at phase 1

    // ── All stage sub-maps initialized to safe empty defaults ─────────────
    prospecting:         { hasPotentialDeal: null },
    qualification:       { projectTitle: lead.projectTitle, projectBrief: '', estimatedBudget: 0 },
    needsAnalysis:       { detailedProjectDetails: '', estimatedCosts: 0, painPoints: '' },
    valueProposition:    { presentationNotes: '', keyValuePoints: [] },
    decisionMakers:      { assignedAdminIds: [], assignedAdminNames: [], stakeholderNotes: '' },
    perceptionAnalysis:  { comparisonRows: [], overallNotes: '' },
    proposal:            { moneyAskedFromClient: 0, initialPaymentAmount: 0,
                           contractStartDate: null, contractEndDate: null,
                           contractTermsDetails: '', proposalDocumentUrl: null },
    negotiationReview:   { moneyAgreedByClient: 0, initialPaymentAgreedByClient: 0,
                           negotiationNotes: '' },
    closedWon:           { isConvertedToProject: false, convertedProjectId: null,
                           convertedAt: null, convertedBy: null },
    closedLost:          { lostReason: '', lostDate: null },

    // ── Metadata ──────────────────────────────────────────────────────────
    isDeleted:        false,
    createdAt:        serverTimestamp(),
    createdBy:        adminUid,
    updatedAt:        serverTimestamp(),
    updatedBy:        adminUid,
  });

  // ── Write 2: Lock the originating Lead ──────────────────────────────────
  const leadRef = doc(db, 'leads', lead.leadId);
  batch.update(leadRef, {
    isConvertedToOpportunity:  true,
    convertedOpportunityId:    newOppRef.id,
    convertedToOpportunityAt:  serverTimestamp(),
    convertedToOpportunityBy:  adminUid,
    updatedAt:                 serverTimestamp(),
    updatedBy:                 adminUid,
  });

  // ── Write 3: Auto-log on the Lead ─────────────────────────────────────
  const leadLogRef = doc(collection(db, 'leads', lead.leadId, 'lead_logs'));
  batch.set(leadLogRef, {
    content:     `Lead converted to Opportunity by ${adminName}. Opportunity ID: ${newOppRef.id}`,
    phase:       'qualified',
    loggedBy:    adminUid,
    loggerName:  adminName,
    createdAt:   serverTimestamp(),
    attachments: [],
  });

  await batch.commit();
  return newOppRef.id;
}
```

---

### 5.2 Handshake 2 — Opportunity → Project

**Trigger:** Admin clicks "Convert to Project" from the `closed_won` stage pane.
**File:** `src/services/opportunitiesService.js`

#### Confirmation Modal — `<ConvertToProjectConfirmModal />`

```
"Convert '[Opportunity Title]' to an active Project?"

  Client:           [clientName]
  Agreed Amount:    ₹[negotiationReview.moneyAgreedByClient]
  Initial Payment:  ₹[negotiationReview.initialPaymentAgreedByClient]
  Contract:         [contractStartDate] → [contractEndDate]

  A new Project will be created. You will need to assign workers
  and complete remaining setup in the Projects section.

  [Cancel]           [Confirm & Create Project →]
```

#### Batch Write Implementation

```js
/**
 * Handshake 2: Converts a Closed Won Opportunity into a new Project document.
 * Atomic writeBatch — all three writes succeed or all fail.
 *
 * @param {OpportunityDocument} opp  - The full closed_won opportunity object
 * @param {string}              adminUid
 * @param {string}              adminName
 * @returns {Promise<string>}        - New projectId
 */
export async function convertOpportunityToProject(opp, adminUid, adminName) {
  const batch = writeBatch(db);

  // ── Write 1: Create the Project document ────────────────────────────────
  const newProjectRef = doc(collection(db, 'projects'));

  batch.set(newProjectRef, {
    // ── Fields mapped from Opportunity ────────────────────────────────────
    title:                    opp.qualification?.projectTitle || opp.title,
    description:              opp.needsAnalysis?.detailedProjectDetails || '',
    clientName:               opp.clientName,
    clientEmail:              opp.clientEmail,
    clientPhone:              opp.clientPhone,

    // ── Financial values locked from Negotiation stage ────────────────────
    estimatedBilling:         opp.negotiationReview?.moneyAgreedByClient ?? 0,
    estimatedBudget:          opp.needsAnalysis?.estimatedCosts ?? 0,
    clientInitialPayment:     opp.negotiationReview?.initialPaymentAgreedByClient ?? 0,
    contractStartDate:        opp.proposal?.contractStartDate ?? null,
    contractEndDate:          opp.proposal?.contractEndDate   ?? null,

    // ── Pre-assigned admins from Decision Makers stage ────────────────────
    assignedAdmins:           opp.decisionMakers?.assignedAdminIds  ?? [adminUid],
    assignedAdminNames:       opp.decisionMakers?.assignedAdminNames ?? [adminName],

    // ── Fields the admin must complete in Projects section ────────────────
    assignedWorkers:          [],       // Admin fills in Projects
    stage:                    'kickoff',
    status:                   'ongoing',
    deadline:                 null,     // Admin must set

    // ── Traceability chain ────────────────────────────────────────────────
    sourceOpportunityId:      opp.opportunityId,
    sourceLeadId:             opp.sourceLeadId,
    convertedFromOpportunity: true,

    // ── Metadata ──────────────────────────────────────────────────────────
    isArchived:               false,
    createdAt:                serverTimestamp(),
    createdBy:                adminUid,
    updatedAt:                serverTimestamp(),
  });

  // ── Write 2: Lock the Opportunity ───────────────────────────────────────
  const oppRef = doc(db, 'opportunities', opp.opportunityId);
  batch.update(oppRef, {
    'closedWon.isConvertedToProject':  true,
    'closedWon.convertedProjectId':    newProjectRef.id,
    'closedWon.convertedAt':           serverTimestamp(),
    'closedWon.convertedBy':           adminUid,
    updatedAt:                         serverTimestamp(),
    updatedBy:                         adminUid,
  });

  // ── Write 3: Auto-log on the Opportunity ─────────────────────────────────
  const oppLogRef = doc(collection(db, 'opportunities', opp.opportunityId, 'opportunity_logs'));
  batch.set(oppLogRef, {
    content:     `Opportunity converted to Project by ${adminName}. Project ID: ${newProjectRef.id}`,
    phase:       'closed_won',
    loggedBy:    adminUid,
    loggerName:  adminName,
    createdAt:   serverTimestamp(),
    attachments: [],
  });

  await batch.commit();
  return newProjectRef.id;
}
```

#### Opportunity → Project Field Mapping Reference

| Opportunity Field | Maps to Project Field | Notes |
|---|---|---|
| `qualification.projectTitle` | `title` | Falls back to `opp.title` |
| `needsAnalysis.detailedProjectDetails` | `description` | |
| `clientName` | `clientName` | Direct copy |
| `clientEmail` | `clientEmail` | Direct copy |
| `clientPhone` | `clientPhone` | Direct copy |
| `negotiationReview.moneyAgreedByClient` | `estimatedBilling` | Locked agreed value |
| `needsAnalysis.estimatedCosts` | `estimatedBudget` | Internal cost estimate |
| `negotiationReview.initialPaymentAgreedByClient` | `clientInitialPayment` | |
| `proposal.contractStartDate` | `contractStartDate` | |
| `proposal.contractEndDate` | `contractEndDate` | |
| `decisionMakers.assignedAdminIds` | `assignedAdmins` | |
| `opportunityId` | `sourceOpportunityId` | Traceability |
| `sourceLeadId` | `sourceLeadId` | Full chain traceability |
| *(none)* | `assignedWorkers: []` | Admin completes in Projects |
| *(none)* | `deadline: null` | Admin completes in Projects |

---

## 6. State Management & Hook Design

### 6.1 `useOpportunities(timeframeFilter)` — Page-Level Hook

**File:** `src/hooks/useOpportunities.js`

Structurally identical to `useLeads` — replace collection name and normalization:

```js
export function useOpportunities(timeframeFilter) {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    const { fromDate, toDate } = resolveDateRange(timeframeFilter);
    const q = query(
      collection(db, 'opportunities'),
      where('isDeleted',  '==', false),
      where('createdAt',  '>=', Timestamp.fromDate(fromDate)),
      where('createdAt',  '<=', Timestamp.fromDate(toDate)),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setOpportunities(snap.docs.map(d => ({ opportunityId: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [timeframeFilter]);

  return { opportunities, loading };
}
```

---

### 6.2 `useOpportunityLogs(opportunityId)` — Modal-Level Hook

**File:** `src/hooks/useOpportunityLogs.js`

```js
export function useOpportunityLogs(opportunityId) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!opportunityId) return;
    const unsub = onSnapshot(
      query(
        collection(db, 'opportunities', opportunityId, 'opportunity_logs'),
        orderBy('createdAt', 'desc')
      ),
      (snap) => {
        setLogs(snap.docs.map(d => ({ logId: d.id, ...d.data() })));
        setLoading(false);
      }
    );
    return () => unsub();
  }, [opportunityId]);

  return { logs, loading };
}
```

---

### 6.3 `viewingPhase` vs `currentPhase` — Critical State Pattern

```js
// OpportunityDetailModal.jsx
const [viewingPhase, setViewingPhase] = useState(opportunity.phase);

// When the live opportunity data updates via onSnapshot and phase changes
// (e.g., admin advances from another device), sync viewingPhase:
useEffect(() => {
  // Only auto-sync if the admin hasn't manually navigated to a different stage
  if (viewingPhase === previousPhaseRef.current) {
    setViewingPhase(opportunity.phase);
  }
  previousPhaseRef.current = opportunity.phase;
}, [opportunity.phase]);

// isReadOnly: true when viewing a stage that isn't the current active phase
const isReadOnly = viewingPhase !== opportunity.phase
                || opportunity.closedWon?.isConvertedToProject === true;
```

---

### 6.4 Stale Reference Fix — Modal Sync

Same pattern as Leads module — derive the live opportunity from the full array:

```js
// OpportunitiesPage.jsx
const activeOpportunity = useMemo(
  () => opportunities.find(o => o.opportunityId === selectedOpp?.opportunityId) ?? selectedOpp,
  [opportunities, selectedOpp]
);
```

---

## 7. Security Rules Additions

Append to `firestore.rules`:

```javascript
// ── opportunities collection ─────────────────────────────────────────────────
match /opportunities/{opportunityId} {

  allow read: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ['admin', 'super_admin'];

  // Opportunities are ONLY created via the Lead→Opportunity handshake (writeBatch).
  // The create rule enforces this by requiring sourceLeadId to be present.
  allow create: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ['admin', 'super_admin'] &&
    request.resource.data.keys().hasAll(['sourceLeadId', 'category', 'phase']) &&
    request.resource.data.phase      == 'prospecting' &&
    request.resource.data.isDeleted  == false;

  // Admins can update opportunities.
  // Category is immutable after creation.
  allow update: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ['admin', 'super_admin'] &&
    request.resource.data.category == resource.data.category &&
    request.resource.data.sourceLeadId == resource.data.sourceLeadId;

  // Hard deletes forbidden. Soft delete via isDeleted: true (update rule above).
  allow delete: if false;

  // ── opportunity_logs subcollection ──────────────────────────────────────
  match /opportunity_logs/{logId} {
    allow read: if request.auth != null &&
      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
        in ['admin', 'super_admin'];

    allow create: if request.auth != null &&
      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
        in ['admin', 'super_admin'];

    // Logs are append-only — immutable once written
    allow update, delete: if false;
  }
}

// ── leads collection — additive update to existing rules ─────────────────────
// Add the new conversion-to-opportunity fields to the allowed update keys.
// If your existing leads update rule uses .affectedKeys(), add these:
//   'isConvertedToOpportunity', 'convertedOpportunityId',
//   'convertedToOpportunityAt', 'convertedToOpportunityBy',
//   'contactedInfo'
```

---

## 8. Component Tree Reference

### 8.1 Leads Module — Changed Components

```
<LeadDetailModal />                              MODIFIED
  ├── Tab: Overview
  │     └── <LeadOverviewPanel />               MODIFIED — added <ContactedInfoCard />
  │           └── <ContactedInfoCard />         NEW
  │                 Fields: productDescription, modeOfContact, contactDate, endOutcome
  │                 Shown when: phase !== 'open'
  ├── Tab: Logs (unchanged)
  │
  ├── [REMOVED] Tab: Financials
  │     └── [REMOVED] <LeadFinancialsPanel />
  │
  └── Footer Right — conditional buttons:
        [Edit Lead Info]                         (unchanged)
        [Convert to Opportunity →]               REPLACES "Convert to Project"
          └── <ConvertToOpportunityConfirmModal />  NEW
        [View Opportunity →]                     NEW — shown after conversion
        [🗑 Delete Lead]                          (unchanged — unqualified phase only)

<LeadPhaseSelector />                           MODIFIED
  └── Phase labels updated: open/contacted/qualified/unqualified
  └── Transition map updated (see §2.5)
```

### 8.2 Opportunities Module — New Components

```
<OpportunitiesPage />                           src/pages/Opportunities/OpportunitiesPage.jsx
  │  owns: useOpportunities(timeframeFilter)
  │  owns: selectedOpportunity state
  │
  ├── <OpportunitiesMetricsBar />               src/pages/Opportunities/OpportunitiesMetricsBar.jsx
  │
  ├── <LeadsTimeFilter />                       REUSED from Leads module
  │
  ├── <OpportunitiesKanbanBoard />              src/pages/Opportunities/OpportunitiesKanbanBoard.jsx
  │     └── <OpportunityCard /> × N            src/components/opportunities/OpportunityCard.jsx
  │
  └── <OpportunityDetailModal />               src/components/opportunities/OpportunityDetailModal.jsx
        │  owns: useOpportunityLogs(opportunityId)
        │  owns: viewingPhase (local state)
        │
        ├── <OpportunityStageNavigator />       src/components/opportunities/OpportunityStageNavigator.jsx
        │     10 stage items with status indicators
        │
        ├── <StageContentPane />                src/components/opportunities/StageContentPane.jsx
        │     └── [Dynamic — one of the 10 stage components]
        │           src/components/opportunities/stages/
        │             ├── ProspectingStage.jsx
        │             ├── QualificationStage.jsx
        │             ├── NeedsAnalysisStage.jsx
        │             ├── ValuePropositionStage.jsx
        │             ├── DecisionMakersStage.jsx
        │             ├── PerceptionAnalysisStage.jsx
        │             ├── ProposalStage.jsx
        │             ├── NegotiationReviewStage.jsx
        │             ├── ClosedWonStage.jsx
        │             └── ClosedLostStage.jsx
        │
        ├── <OpportunityLogsPanel />            src/components/opportunities/OpportunityLogsPanel.jsx
        │     (collapsible, bottom of right pane)
        │
        └── Footer:
              <PhaseAdvanceControls />          src/components/opportunities/PhaseAdvanceControls.jsx
              <ConvertToProjectConfirmModal />  src/components/opportunities/ConvertToProjectConfirmModal.jsx

```

### 8.3 Shared Utility Components

| Component | File | Used By |
|-----------|------|---------|
| `<OpportunityCategoryBadge />` | `src/components/opportunities/OpportunityCategoryBadge.jsx` | Card, Modal header |
| `<OpportunityPhasePill />` | `src/components/opportunities/OpportunityPhasePill.jsx` | Card, Navigator |
| `<StageStatusIcon />` | `src/components/opportunities/StageStatusIcon.jsx` | Navigator (✓ / ● / ○) |
| `<OpportunitySkeletonCard />` | `src/components/opportunities/OpportunitySkeletonCard.jsx` | Kanban loading state |
| `<ContactedInfoCard />` | `src/components/leads/ContactedInfoCard.jsx` | Lead modal + opp overview |
| `normalizeLeadPhase()` | `src/utils/leadPhaseNormalizer.js` | `useLeads` hook only |
| `STAGE_COMPONENTS` registry | `src/components/opportunities/stages/index.js` | `StageContentPane` |
