# CRM_Update_Blueprint_v2.md
**Wavelet CRM SAAS — Agentic AI Upgrade Blueprint**
**Prepared for:** Gemini Flash Autonomous Coding Agent
**Version:** 2.0.0
**Base System:** Wavelet CRM SAAS (React 18 / Firebase / Vite)

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema Changes](#2-database-schema-changes)
3. [Import/Export & Staging Logic](#3-importexport--staging-logic)
4. [The Autonomous Loop](#4-the-autonomous-loop)
5. [UI/UX Component Breakdown](#5-uiux-component-breakdown)
6. [MCP Integration Strategy](#6-mcp-integration-strategy)
7. [Implementation Checklist](#7-implementation-checklist)

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 Transition Summary

| Dimension | Old Architecture (v1) | New Architecture (v2) |
|---|---|---|
| Import pipeline | Manual Excel upload → staging → manual commit | Excel + Website Webhook → AI Garbage Filter → Staging → Manual or Auto-commit |
| Lead phases | Initial → Negotiation → Final → Failed | Initial → Contacted → Success / Fail |
| AI outreach trigger | One-shot dispatch on import | Cyclical autonomous loop until terminal state |
| AI feedback | None | Structured summary + feedback + closure signal per cycle |
| Execution modes | None / single-mode | Manual, Hybrid, Automatic (per-lead toggle) |
| Chat UI | None | Full conversation history panel inside Lead Detail |
| MCP support | None | Pluggable MCP connectors for third-party tool orchestration |
| Prompt engineering | Static master prompt | Dynamic per-lead prompt assembled from lead data + offer + history + custom instructions |

### 1.2 High-Level Data Flow (v2)

```
[Website Form Webhook]  ──►┐
[Excel Import]          ──►├──► AI Garbage Filter (Cloud Function)
[Lead Gen / Ad Tools]   ──►┘         │
                                      ▼
                              Staging Collection
                              (validate / edit)
                                      │
                          ┌───────────┴────────────┐
                     Manual Mode               Automatic Mode
                    (admin commits)         (auto-commit on 0 errors)
                          └───────────┬────────────┘
                                      ▼
                            leads/{leadId}  [phase: initial]
                                      │
                          ┌───────────┴──────────────────┐
                     Manual Mode    Hybrid Mode      Automatic Mode
                     (no AI)    (human approves     (fully agentic)
                                 AI prompt)
                                      │
                                      ▼
                            leads/{leadId}  [phase: contacted]
                            ┌─── Prompt Engineering (AI Filter) ───┐
                            │  lead data + offer + company info     │
                            │  + conversation history               │
                            │  + custom instructions                │
                            └───────────────┬───────────────────────┘
                                            ▼
                              Third-Party API (Vapi / Twilio)
                              (AI Voice Call / WhatsApp)
                                            │
                                            ▼
                              API Response: summary + feedback
                              + closure_signal (success/fail/standby)
                                            │
                            ┌───────────────┴──────────────┐
                        success/fail                    standby
                            │                               │
                     terminal phase              loop back → re-prompt
                     (opportunity /              (inject history + new offer)
                      fail list)
```

---

## 2. DATABASE SCHEMA CHANGES

### 2.1 Leads Collection — `leads/{leadId}`

> **Note to agent:** The existing `isConverted`, `source`, `estimatedBilling`, `estimatedBudget`, and negotiation fields are **preserved**. Only the new fields documented below are additive or supersede old phase/status labels.

```typescript
interface LeadDocument {
  // ── Identity ────────────────────────────────────────────────
  id: string;                        // Firestore auto-ID
  tenantId: string;                  // Multi-tenant isolation key

  // ── Core Lead Data (updated required fields) ────────────────
  name: string;                      // REQUIRED
  place: string;                     // REQUIRED — city / region
  email: string;                     // REQUIRED — validated email
  phone: string;                     // REQUIRED — E.164 format for AI dispatch
  linkedin?: string;                 // OPTIONAL
  instagram?: string;                // OPTIONAL
  serviceDescription: string;        // REQUIRED — description of service requested
  category: 'hot' | 'neutral' | 'cold'; // REQUIRED

  // ── Phase ────────────────────────────────────────────────────
  phase: 'initial' | 'contacted' | 'success' | 'fail';

  // ── Execution Mode (per-lead) ────────────────────────────────
  executionMode: 'manual' | 'hybrid' | 'automatic';

  // ── Contacted Phase State ────────────────────────────────────
  contactCycles: ContactCycle[];      // ordered array, append-only
  currentCycleIndex: number;          // points to latest ContactCycle
  standbyUntil?: Timestamp;           // optional snooze for retry scheduling

  // ── Chat UI ──────────────────────────────────────────────────
  chatHistory: ChatMessage[];         // rendered in Lead Detail Chat UI

  // ── Manual Instruction Override ─────────────────────────────
  pendingManualInstruction?: string;  // set by admin; cleared after dispatch
  manualInstructionHistory: ManualInstruction[]; // full audit trail

  // ── AI Prompt Approval (Hybrid mode) ────────────────────────
  pendingPromptApproval?: PromptApproval; // non-null = waiting for human

  // ── Outcome ──────────────────────────────────────────────────
  closureSignal?: 'success' | 'fail' | 'standby';
  closureNote?: string;
  convertedToOpportunityId?: string;  // set on success conversion

  // ── Legacy / Preserved ───────────────────────────────────────
  isConverted: boolean;
  source?: string;
  estimatedBilling?: number;
  estimatedBudget?: number;
  negotiation?: NegotiationBlock;     // unchanged from v1

  // ── Timestamps ───────────────────────────────────────────────
  createdAt: Timestamp;
  updatedAt: Timestamp;
  contactedAt?: Timestamp;
  closedAt?: Timestamp;
}

interface ContactCycle {
  cycleId: string;                   // uuid
  cycleIndex: number;
  dispatchedAt: Timestamp;
  channel: 'vapi_voice' | 'twilio_whatsapp';
  promptSentToApi: string;           // full engineered prompt
  rawApiResponse?: string;           // raw payload from third-party API
  // AI-filtered structured output:
  meetingSummary?: string;
  aiFeedback?: string;
  closureSignal?: 'success' | 'fail' | 'standby';
  filteredAt?: Timestamp;
  status: 'dispatched' | 'awaiting_response' | 'response_received' | 'filtered' | 'error';
}

interface ChatMessage {
  messageId: string;
  role: 'system' | 'ai_agent' | 'lead' | 'admin' | 'filter';
  content: string;
  cycleRef?: string;                 // optional link to ContactCycle.cycleId
  timestamp: Timestamp;
  metadata?: Record<string, unknown>;
}

interface ManualInstruction {
  instructionId: string;
  text: string;
  submittedBy: string;               // uid of admin
  submittedAt: Timestamp;
  appliedToCycle?: string;           // cycleId this was used in
}

interface PromptApproval {
  approvalId: string;
  generatedPrompt: string;           // AI-generated, pending human edit/approve
  editedPrompt?: string;             // human-modified version
  status: 'pending' | 'approved' | 'rejected';
  generatedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
}

interface NegotiationBlock {         // unchanged from v1
  askedFromClient?: number;
  clientAgreedOn?: number;
  clientPaidAmount?: number;
}
```

---

### 2.2 Staging Collection — `staging/{stagingBatchId}/records/{recordId}`

```typescript
interface StagingBatch {
  batchId: string;
  tenantId: string;
  importedAt: Timestamp;
  importSource: 'excel_upload' | 'website_webhook' | 'api_push';
  totalRecords: number;
  validCount: number;
  errorCount: number;
  garbageDiscardedCount: number;     // records AI filter removed entirely
  importMode: 'manual' | 'automatic';
  autonomousOutreachEnabled: boolean;
  outreachChannel?: 'vapi_voice' | 'twilio_whatsapp';
  campaignContext?: string;
  status: 'staging' | 'committed' | 'partial';
  committedAt?: Timestamp;
  committedBy?: string;              // uid or 'system' for auto-commit
}

interface StagingRecord {
  recordId: string;
  batchId: string;

  // ── Raw ingested data ────────────────────────────────────────
  rawData: Record<string, unknown>;  // original pre-filter row

  // ── AI Garbage Filter output ─────────────────────────────────
  garbageScore: number;              // 0.0–1.0; >= 0.8 = discard
  garbageReason?: string;
  isDiscarded: boolean;

  // ── Mapped lead fields ───────────────────────────────────────
  name: string;
  place: string;
  email: string;
  phone: string;
  linkedin?: string;
  instagram?: string;
  serviceDescription: string;
  category: 'hot' | 'neutral' | 'cold';

  // ── Validation ───────────────────────────────────────────────
  validationErrors: ValidationError[];
  isValid: boolean;
  isManuallyEdited: boolean;

  // ── State ────────────────────────────────────────────────────
  status: 'pending' | 'committed' | 'discarded';
  committedLeadId?: string;          // populated on commit
}

interface ValidationError {
  field: string;
  rule: string;
  message: string;
}
```

---

### 2.3 Settings / Tenant Config — `tenants/{tenantId}/config/aiSettings`

```typescript
interface AISettings {
  // ── BYOK API Keys (AES-256-GCM encrypted at rest) ───────────
  vapiKeyRef?: string;               // Cloud Function decrypts on demand
  twilioKeyRef?: string;
  openaiKeyRef?: string;             // for AI Filter + Prompt Engineering

  // ── Master Prompt ────────────────────────────────────────────
  masterSystemPrompt?: string;
  masterPromptGeneratedAt?: Timestamp;
  crawledWebsiteUrl?: string;

  // ── Import/Export Defaults ───────────────────────────────────
  defaultImportMode: 'manual' | 'automatic';
  defaultExecutionMode: 'manual' | 'hybrid' | 'automatic';

  // ── MCP Connectors ───────────────────────────────────────────
  mcpConnectors: MCPConnector[];

  // ── Webhook ──────────────────────────────────────────────────
  websiteWebhookSecret?: string;
  webhookEnabled: boolean;
}

interface MCPConnector {
  connectorId: string;
  name: string;
  type: 'vapi' | 'twilio' | 'make' | 'zapier' | 'n8n' | 'custom';
  endpointUrl: string;
  encryptedApiKey?: string;
  isActive: boolean;
  toolDefinitions: MCPToolDefinition[];
}

interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
}
```

---

## 3. IMPORT/EXPORT & STAGING LOGIC

### 3.1 Lead Data Field Specification

The canonical lead fields for import/export are:

| Field | Required | Validation Rule |
|---|---|---|
| `name` | YES | non-empty string |
| `place` | YES | non-empty string |
| `email` | YES | RFC 5322 email regex |
| `phone` | YES (E.164 if AI outreach) | E.164 `^\+[1-9]\d{6,14}$` |
| `linkedin` | NO | URL pattern or empty |
| `instagram` | NO | URL/handle or empty |
| `serviceDescription` | YES | non-empty string, min 10 chars |
| `category` | YES | enum: hot / neutral / cold |

### 3.2 Excel Template (Skeleton)

Column order in the downloadable template:

```
A: name | B: place | C: email | D: phone | E: linkedin | F: instagram | G: serviceDescription | H: category
```

Template generation uses the `xlsx` library already in-stack. Enforce strict header matching on parse; reject files where headers do not match exactly (case-insensitive trim allowed).

### 3.3 Website Form Webhook Integration

**Endpoint:** `POST /api/webhook/lead-intake` (Firebase Cloud Function, HTTP trigger)

```
Request Headers:
  X-Webhook-Secret: <tenantId:webhookSecret HMAC-SHA256 sig>

Request Body (JSON):
{
  "tenantId": "...",
  "source": "website_form",
  "leads": [ { name, place, email, phone, linkedin?, instagram?, serviceDescription, category } ]
}

Processing:
  1. Verify HMAC signature against stored webhookSecret.
  2. Pass payload to AI Garbage Filter (see §3.4).
  3. Write valid records to staging/{newBatchId}/records/.
  4. If defaultImportMode === 'automatic' AND 0 validation errors → auto-commit.
  5. Else → surface in Import/Export UI staging table for admin review.
```

### 3.4 AI Garbage Filter Logic

**Cloud Function:** `filterGarbageRecords(records: RawRecord[]): FilteredRecord[]`

Prompt template sent to OpenAI (or internal Claude endpoint):

```
SYSTEM:
You are a data quality filter for a CRM lead intake system.
Your task is to score each lead record for data quality.
Return ONLY a JSON array with no markdown.

USER:
For each lead in the array below, return:
{
  "index": <original array index>,
  "garbageScore": <float 0.0-1.0>,
  "garbageReason": "<short reason if score >= 0.5, else null>",
  "correctedCategory": "<hot|neutral|cold if inferrable, else original>"
}
Rules:
- score 0.8+ = discard (clearly fake, placeholder, or incoherent data)
- score 0.5-0.79 = flag for review
- score < 0.5 = pass
- Fake names (e.g. "asdf", "test", "xxx"), dummy emails (test@test.com), invalid phone patterns all increase score.

LEADS: {{JSON.stringify(records)}}
```

Post-filter:
- Records with `garbageScore >= 0.8` → set `isDiscarded: true`, increment `garbageDiscardedCount`.
- Records with `0.5 <= score < 0.8` → flag with `validationErrors` entry, surfaced in staging UI as warnings (orange row).
- Remaining validation runs field-level rules from §3.1 on non-discarded records.

### 3.5 Import Mode Toggle Logic

```
importMode === 'manual':
  - All non-discarded records enter staging table (including flagged).
  - Admin edits rows inline; each edit triggers re-validation.
  - "Commit Leads" button enabled only when validCount === totalRecords - garbageDiscardedCount.
  - Admin clicks Commit → Firebase batch write to leads/.
  - leadPhase set to 'initial'.

importMode === 'automatic':
  - After AI filter runs, if errorCount === 0 (excluding discarded):
      → Skip staging UI review.
      → Immediately batch-commit all valid records to leads/.
      → leadPhase set to 'initial'.
      → Trigger autonomous workflow if autonomousOutreachEnabled.
  - If errorCount > 0:
      → Fall back to staging UI, notify admin of errors requiring review.
      → Admin corrects, then can re-trigger auto-commit.
```

---

## 4. THE AUTONOMOUS LOOP

### 4.1 Cloud Function Registry

| Function Name | Trigger | Purpose |
|---|---|---|
| `ingestWebhookLeads` | HTTP POST | Receive website form data, run garbage filter, write to staging |
| `filterGarbageRecords` | Callable | AI garbage scoring for both Excel and webhook imports |
| `autoCommitStagingBatch` | Firestore `staging/{id}` onCreate | If importMode=automatic and 0 errors, auto-commit |
| `dispatchLeadCycle` | Callable + Firestore trigger | Engineer prompt, call third-party API, write cycle record |
| `processApiCallback` | HTTP POST (webhook from Vapi/Twilio) | Receive meeting data, run AI filter, update lead, decide next action |
| `engineerPrompt` | Internal (called by dispatchLeadCycle) | Assemble prompt from lead data + history + master prompt + instructions |
| `evaluateClosure` | Internal (called by processApiCallback) | Determine success/fail/standby from filtered API response |
| `convertLeadToOpportunity` | Callable | Atomic Firestore batch: lead → opportunity, lock lead |

### 4.2 Prompt Engineering — `engineerPrompt(leadId, cycleIndex)`

```typescript
async function engineerPrompt(leadId: string, cycleIndex: number): Promise<string> {
  const lead = await getLeadDoc(leadId);
  const settings = await getTenantAISettings(lead.tenantId);

  const sections = [
    `## MASTER COMPANY CONTEXT\n${settings.masterSystemPrompt}`,
    `## LEAD PROFILE\nName: ${lead.name}\nPlace: ${lead.place}\nService Requested: ${lead.serviceDescription}\nCategory: ${lead.category}`,
    `## PREVIOUS CONTACT HISTORY (${cycleIndex} cycles)\n${formatChatHistory(lead.chatHistory)}`,
    `## LATEST AI FEEDBACK\n${lead.contactCycles.at(-1)?.aiFeedback ?? 'None'}`,
    `## CUSTOM ADMIN INSTRUCTION\n${lead.pendingManualInstruction ?? 'None'}`,
    `## CAMPAIGN CONTEXT\n${settings.campaignContext ?? 'None'}`,
    `## INSTRUCTIONS\nContinue the conversation with the lead. Your goal is to qualify and convert.\nRespond naturally, referencing the prior context. Follow company guidelines strictly.`,
  ];

  const rawPrompt = sections.join('\n\n');

  // Run through AI filter for quality check
  const engineered = await callOpenAI({
    systemPrompt: 'You are a senior sales strategist. Refine the following prompt for a voice/WhatsApp AI agent to maximize conversion probability. Return only the refined prompt text.',
    userMessage: rawPrompt,
  });

  return engineered;
}
```

### 4.3 Dispatch Flow — `dispatchLeadCycle(leadId)`

```
1. Fetch lead document.
2. Assert phase === 'contacted' OR (phase === 'initial' AND first dispatch).
3. Call engineerPrompt(leadId, currentCycleIndex + 1).
4. IF executionMode === 'hybrid':
     a. Write PromptApproval doc to lead.pendingPromptApproval with status='pending'.
     b. STOP. Wait for human approval via UI (see §5.3).
   IF executionMode === 'automatic' OR 'manual' (manual only on explicit admin trigger):
     a. Proceed to step 5.
5. Select channel (vapi_voice or twilio_whatsapp) from lead or batch setting.
6. Decrypt tenant API key via Cloud Function secure call.
7. Create ContactCycle record with status='dispatched'.
8. Update lead.phase to 'contacted', lead.updatedAt.
9. Push engineered prompt + lead data to selected API endpoint.
10. Append system ChatMessage: "Cycle #N dispatched via <channel> at <timestamp>".
11. Clear lead.pendingManualInstruction (set to null).
```

### 4.4 API Response Processing — `processApiCallback(payload)`

```
Triggered by: Vapi/Twilio webhook POST to /api/callback/lead-response

1. Parse payload. Extract: callId/messageId, leadId (from metadata), raw transcript/message.
2. Locate ContactCycle by callId; assert status === 'dispatched' or 'awaiting_response'.
3. Update cycle.rawApiResponse, cycle.status = 'response_received'.

4. Run AI Filter (structured extraction):
   SYSTEM: You are a CRM data extraction agent. Extract the following from the API response.
   Return ONLY valid JSON, no markdown.
   {
     "meetingSummary": "<200-word max summary of the contact>",
     "aiFeedback": "<assessment: what went well, objections raised, next best action>",
     "closureSignal": "success" | "fail" | "standby",
     "closureNote": "<reason for closure signal>"
   }
   USER: {{raw API response / transcript}}

5. Write extracted data to cycle (meetingSummary, aiFeedback, closureSignal).
6. Append ChatMessages:
     - role:'ai_agent'  — meetingSummary
     - role:'filter'    — aiFeedback

7. Call evaluateClosure(lead, cycle):
   IF closureSignal === 'success':
     → lead.phase = 'success', lead.closedAt = now
     → Call convertLeadToOpportunity(leadId) [atomic batch]
     → Append ChatMessage: "✅ Lead converted to opportunity."
   IF closureSignal === 'fail':
     → lead.phase = 'fail', lead.closedAt = now
     → Append ChatMessage: "❌ Lead marked as failed."
   IF closureSignal === 'standby':
     → IF executionMode === 'automatic':
          → Schedule next dispatchLeadCycle() after delay (configurable, default 24h via Cloud Tasks)
          → Append ChatMessage: "🔄 Standby. Next contact scheduled."
       IF executionMode === 'hybrid':
          → Generate new prompt, write to pendingPromptApproval (status='pending')
          → Notify admin via UI badge
       IF executionMode === 'manual':
          → No automated action. Admin sees standby state in Chat UI.
```

### 4.5 Cyclical Loop Diagram

```
dispatchLeadCycle()
       │
       ▼
[engineerPrompt]  ◄─────────────────────────────────┐
       │                                              │
       ▼                                              │
[Hybrid? → pendingPromptApproval]                    │
       │ (approved)                                   │
       ▼                                              │
[Third-Party API Call]                               │
       │                                              │
       ▼                                              │
[processApiCallback]                                  │
       │                                              │
       ▼                                              │
[AI Filter → structured output]                      │
       │                                              │
       ├── success ──► convertLeadToOpportunity       │
       │                                              │
       ├── fail ─────► mark lead.phase = 'fail'       │
       │                                              │
       └── standby ──► schedule next cycle ───────────┘
```

---

## 5. UI/UX COMPONENT BREAKDOWN

> Component paths are relative to `src/components/`.

### 5.1 Lead Detail View — `leads/LeadDetailView.jsx`

**Layout:** Two-column on desktop (lead info left 40%, chat right 60%). Single column stacked on mobile.

**Sub-components:**

```
LeadDetailView
├── LeadInfoPanel
│   ├── LeadHeaderCard         — name, category badge, place, phase pill
│   ├── LeadContactFields      — email, phone, linkedin, instagram (read-only display)
│   ├── LeadServiceDescription — serviceDescription text block
│   ├── LeadPhaseTimeline      — visual step indicator: Initial → Contacted → Success/Fail
│   ├── ExecutionModeToggle    — see §5.2
│   └── ManualInstructionArea  — see §5.5
└── LeadChatPanel
    ├── ChatMessageList        — scrollable, renders ChatMessage[]
    │   ├── SystemMessage      — grey pill style
    │   ├── AgentMessage       — blue bubble (ai_agent role)
    │   ├── FilterMessage      — amber bubble (filter role)
    │   └── AdminMessage       — green bubble (admin role)
    ├── CycleAccordion         — expandable per-cycle detail (summary, feedback, signal)
    └── ChatActionBar          — context-aware action buttons (see below)
```

**ChatActionBar button states by mode and phase:**

| Phase | Manual mode | Hybrid mode | Automatic mode |
|---|---|---|---|
| initial | "Mark as Contacted" button | "Initiate AI Contact" → approval modal | "Start Autonomous Loop" button |
| contacted | "Log Manual Contact" | "Review Pending Prompt" (badge) or "Generate Next Prompt" | Status indicator only |
| success/fail | Read-only badge | Read-only badge | Read-only badge |

---

### 5.2 Execution Mode Toggle — `leads/ExecutionModeToggle.jsx`

**Props:**
```typescript
interface ExecutionModeToggleProps {
  currentMode: 'manual' | 'hybrid' | 'automatic';
  leadId: string;
  onModeChange: (newMode: 'manual' | 'hybrid' | 'automatic') => Promise<void>;
  disabled?: boolean; // true when cycle is in-flight
}
```

**UI spec:**
- Segmented 3-way toggle button group (not a dropdown).
- Labels: `Manual` | `Hybrid` | `Auto`.
- Icons: `UserIcon` | `UsersIcon` | `BoltIcon` (Lucide).
- Changing mode triggers Firestore update + confirmation toast.
- Disabled with tooltip "Mode locked during active dispatch" when a cycle is in-flight (`cycle.status === 'dispatched'`).

---

### 5.3 Hybrid Mode Prompt Approval Modal — `leads/PromptApprovalModal.jsx`

**Trigger:** Opens automatically when `lead.pendingPromptApproval.status === 'pending'` and user opens the lead, or when admin clicks "Review Pending Prompt" in ChatActionBar.

**Props:**
```typescript
interface PromptApprovalModalProps {
  approval: PromptApproval;
  leadId: string;
  onApprove: (finalPrompt: string) => Promise<void>;
  onReject: () => Promise<void>;
  onClose: () => void;
}
```

**Modal layout:**
```
┌──────────────────────────────────────────────────┐
│ 🤖 AI-Generated Prompt — Review Before Sending   │
├──────────────────────────────────────────────────┤
│ [Editable textarea — pre-filled with             │
│  approval.generatedPrompt, full height]          │
│                                                  │
│ Character count: NNN                             │
├──────────────────────────────────────────────────┤
│ [Reject]              [Edit & Approve →]         │
└──────────────────────────────────────────────────┘
```

- Textarea is fully editable; edited content stored in `approval.editedPrompt`.
- "Edit & Approve" calls `onApprove(editedPrompt ?? generatedPrompt)`.
- Approval triggers immediate `dispatchLeadCycle()` continuation from step 5.
- Rejection sets `approval.status = 'rejected'`, appends admin ChatMessage "Prompt rejected by admin."

---

### 5.4 Import Mode Toggle — `import/ImportModeToggle.jsx`

**Location:** Import/Export section, above staging table.

```typescript
interface ImportModeToggleProps {
  mode: 'manual' | 'automatic';
  onChange: (mode: 'manual' | 'automatic') => void;
}
```

- 2-way segmented toggle: `Manual` | `Automatic`.
- Tooltip on Automatic: "Valid leads will be committed instantly after AI filtering. Errors will still require review."

---

### 5.5 Manual Instruction Override — `leads/ManualInstructionArea.jsx`

**Placement:** Inside `LeadInfoPanel`, visible only when `lead.phase === 'contacted'`.

```typescript
interface ManualInstructionAreaProps {
  currentInstruction: string | undefined;
  leadId: string;
  onSubmit: (instruction: string) => Promise<void>;
  isDisabled: boolean; // true in automatic mode
}
```

**UI spec:**
- Label: "Custom Instruction for Next Contact"
- Multiline textarea (min 3 rows, max 10 rows auto-expand).
- Placeholder: "Enter any specific message or instruction to be included in the next AI prompt sent to this lead..."
- Submit button: "Save Instruction".
- On submit: writes to `lead.pendingManualInstruction`; appends ChatMessage (role:'admin') with the instruction text.
- In Automatic mode: textarea is disabled with note "Switch to Manual or Hybrid mode to send custom instructions."
- Shows last submitted instruction with timestamp below the textarea as a read-only preview.

---

### 5.6 Staging Table Updates — `import/StagingTable.jsx`

Updates to existing staging table:

- **New columns:** `linkedin`, `instagram`, `serviceDescription` (truncated with tooltip).
- **Row color coding:**
  - Red: `validationErrors.length > 0` (hard errors).
  - Orange: `garbageScore >= 0.5 && < 0.8` (AI-flagged, not discarded).
  - Strikethrough grey: `isDiscarded === true` (AI garbage, not editable).
- **Discarded row tooltip:** Shows `garbageReason` on hover.
- **Garbage summary bar:** Above table — "AI discarded N records as garbage. NNN records pending review."

---

### 5.7 Lead Phase Indicator — `leads/LeadPhaseTimeline.jsx`

Replace old Kanban phase pill with inline horizontal stepper:

```
● Initial  ──►  ● Contacted  ──►  ◐ Success / ✕ Fail
```

- Active phase node: filled circle with phase label.
- Future phase: hollow circle.
- Terminal phases: green checkmark (success) or red X (fail).
- Clicking "Initial" node when `executionMode !== 'manual'` triggers first dispatch confirmation dialog.

---

## 6. MCP INTEGRATION STRATEGY

### 6.1 Architecture

MCP (Model Context Protocol) connectors extend the AI agent's capabilities by exposing external tools callable during prompt engineering and the autonomous loop. Each connector is a registered entry in `tenants/{tenantId}/config/aiSettings.mcpConnectors`.

```
AI Agent (Cloud Function: engineerPrompt / dispatchLeadCycle)
       │
       ▼
MCPRouter.selectTools(context)
       │
       ├── VapiMCPConnector     — initiate/manage voice calls
       ├── TwilioMCPConnector   — send/receive WhatsApp messages
       ├── MakeMCPConnector     — trigger Make.com scenarios
       ├── ZapierMCPConnector   — trigger Zapier zaps
       ├── N8nMCPConnector      — invoke n8n workflows
       └── CustomMCPConnector   — generic HTTP tool connector
```

### 6.2 MCPRouter — `functions/src/mcp/MCPRouter.ts`

```typescript
class MCPRouter {
  async callTool(connectorId: string, toolName: string, input: Record<string, unknown>): Promise<unknown> {
    const connector = await this.getActiveConnector(connectorId);
    const toolDef = connector.toolDefinitions.find(t => t.name === toolName);
    // Validate input against toolDef.inputSchema (JSON Schema)
    // Decrypt API key
    // POST to connector.endpointUrl with {tool: toolName, input, apiKey}
    // Return parsed response
  }

  async listAvailableTools(tenantId: string): Promise<MCPToolDefinition[]> {
    // Returns all active connector tool definitions for use in AI system prompt
  }
}
```

### 6.3 Tool Definitions (Built-in Connectors)

**VapiMCPConnector tools:**
```json
[
  {
    "name": "initiate_voice_call",
    "description": "Initiate an outbound AI voice call to a lead via Vapi",
    "inputSchema": {
      "type": "object",
      "properties": {
        "phoneNumber": { "type": "string", "pattern": "^\\+[1-9]\\d{6,14}$" },
        "systemPrompt": { "type": "string" },
        "campaignContext": { "type": "string" },
        "webhookCallbackUrl": { "type": "string" }
      },
      "required": ["phoneNumber", "systemPrompt"]
    }
  },
  {
    "name": "get_call_recording",
    "description": "Retrieve transcript and recording URL for a completed Vapi call",
    "inputSchema": {
      "type": "object",
      "properties": { "callId": { "type": "string" } },
      "required": ["callId"]
    }
  }
]
```

**TwilioMCPConnector tools:**
```json
[
  {
    "name": "send_whatsapp_message",
    "description": "Send a WhatsApp message to a lead via Twilio",
    "inputSchema": {
      "type": "object",
      "properties": {
        "toNumber": { "type": "string" },
        "messageBody": { "type": "string", "maxLength": 4096 },
        "templateSid": { "type": "string" }
      },
      "required": ["toNumber", "messageBody"]
    }
  }
]
```

### 6.4 MCP Tool Injection into AI Prompts

When `executionMode === 'automatic'` and `mcpConnectors` are active, available tool definitions are injected into the system prompt for the AI agent:

```
## AVAILABLE TOOLS
You have access to the following tools. Call them by name with the required inputs.
{{mcpRouter.listAvailableTools(tenantId) | format as tool list}}
```

The AI agent can then instruct the Cloud Function which tool to call as part of its structured JSON response, enabling multi-step autonomous workflows (e.g., send WhatsApp → wait → initiate voice follow-up).

### 6.5 BYOK Key Management (Preserved from v1, Extended)

- All MCP connector API keys are encrypted via AES-256-GCM in a Firebase Cloud Function.
- Keys are never written to Firestore in plaintext.
- Decryption occurs exclusively in-memory during the `MCPRouter.callTool()` execution context.
- Settings UI in the Settings tab allows adding/removing MCP connectors with key encryption flow.

---

## 7. IMPLEMENTATION CHECKLIST

> Use this as the execution task list. Each item is independently implementable.

### Phase A — Schema & Backend Foundation
- [ ] A1: Update Firestore security rules for new `leads` and `staging` schema fields.
- [ ] A2: Create `filterGarbageRecords` Cloud Function (OpenAI integration).
- [ ] A3: Create `ingestWebhookLeads` HTTP Cloud Function with HMAC verification.
- [ ] A4: Create `autoCommitStagingBatch` Firestore trigger function.
- [ ] A5: Create `engineerPrompt` internal utility (Cloud Function).
- [ ] A6: Create `dispatchLeadCycle` Callable Cloud Function.
- [ ] A7: Create `processApiCallback` HTTP Cloud Function (Vapi/Twilio webhook receiver).
- [ ] A8: Create `evaluateClosure` internal utility.
- [ ] A9: Create `convertLeadToOpportunity` Callable Cloud Function (atomic batch).
- [ ] A10: Implement `MCPRouter` class and built-in connector definitions.

### Phase B — Import/Export UI Updates
- [ ] B1: Update Excel template generator to include new fields (linkedin, instagram, serviceDescription).
- [ ] B2: Update Excel parser to map new columns.
- [ ] B3: Integrate `filterGarbageRecords` call into import pipeline.
- [ ] B4: Add `ImportModeToggle` component (Manual / Automatic).
- [ ] B5: Update `StagingTable` with new columns, row color coding, and garbage summary bar.
- [ ] B6: Add website webhook configuration UI in Settings tab.

### Phase C — Lead Detail View
- [ ] C1: Scaffold `LeadDetailView` two-column layout.
- [ ] C2: Build `LeadInfoPanel` with sub-components.
- [ ] C3: Build `LeadPhaseTimeline` stepper component.
- [ ] C4: Build `ExecutionModeToggle` 3-way segmented control.
- [ ] C5: Build `LeadChatPanel` with `ChatMessageList` and message role variants.
- [ ] C6: Build `CycleAccordion` for per-cycle detail expansion.
- [ ] C7: Build `ChatActionBar` with context-aware button states.
- [ ] C8: Build `ManualInstructionArea` with submit and history display.
- [ ] C9: Build `PromptApprovalModal` for Hybrid mode.

### Phase D — Settings & MCP UI
- [ ] D1: Add MCP Connectors management section in Settings tab.
- [ ] D2: Implement connector CRUD with encrypted key storage flow.
- [ ] D3: Add import/export default mode settings.
- [ ] D4: Add webhook secret generation and display UI.

### Phase E — Integration & Testing
- [ ] E1: End-to-end test: Excel import → garbage filter → staging → manual commit → lead created.
- [ ] E2: End-to-end test: Automatic mode import → auto-commit → autonomous loop dispatch.
- [ ] E3: End-to-end test: Hybrid mode — prompt approval → dispatch → callback → standby → re-prompt.
- [ ] E4: End-to-end test: Manual mode — no autonomous actions triggered.
- [ ] E5: Test website webhook ingestion with HMAC validation.
- [ ] E6: Test MCP connector tool call routing.

---

*End of CRM_Update_Blueprint_v2.md*
*This document is authoritative. Implement strictly in the order of the Phase A → E checklist unless dependencies require reordering.*
