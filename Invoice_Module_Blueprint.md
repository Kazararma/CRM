# Invoice Module Blueprint
### Wavelet CRM · React 18 + Vite + Tailwind CSS + Lucide React + Firebase Firestore
#### `Invoice_Module_Blueprint.md`

> **Document Authority:** This blueprint is the complete specification for the Invoice module. It covers the Firestore schema, all data-layer hooks and service functions, the Admin UI component hierarchy, the PDF generation strategy using `@react-pdf/renderer`, and the integration touchpoints with the existing `ProjectDashboardCard`. Implement sections in the order they appear. The existing collections (`users`, `projects`, `leads`, `opportunities`, `salary_transactions`, `shifts`) must not be modified.

---

## Table of Contents
1. [Module Overview & Constraints](#1-module-overview--constraints)
2. [Firestore Schema — `invoices` Collection](#2-firestore-schema--invoices-collection)
3. [State Management & Data Layer](#3-state-management--data-layer)
4. [UI Component Architecture](#4-ui-component-architecture)
5. [PDF Generation Strategy](#5-pdf-generation-strategy)
6. [Integration Points — ProjectDashboardCard](#6-integration-points--projectdashboardcard)
7. [Security Rules Additions](#7-security-rules-additions)
8. [Package Dependencies](#8-package-dependencies)
9. [Component Tree Reference](#9-component-tree-reference)

---

## 1. Module Overview & Constraints

### 1.1 Visibility
The Invoice section (`/invoices`) is **exclusively visible to `admin` and `super_admin` roles**. Route-level guards must redirect workers before any data is fetched. Workers have zero read access to invoice documents in Firestore Security Rules.

### 1.2 Two Invoice Origins

| Origin Type | How Created | `projectId` Field |
|------------|-------------|-------------------|
| **From Scratch** | Admin clicks "New Invoice" in the Invoices section | `null` |
| **From Project** | Admin clicks "Generate Invoice" on a `ProjectDashboardCard` | `string` — the project's Firestore ID |

Both types use the same Firestore document schema and the same `<InvoiceFormModal />`. The only difference is that project-derived invoices arrive with pre-filled fields.

### 1.3 Currency Formatting
All monetary values use the existing `formatINR` utility. Invoice line-item `amount` values, `subTotal`, `taxAmount`, and `total` must all pass through `formatINR` for display. The stored Firestore values are raw JavaScript `number` types (no formatting, no currency symbols).

### 1.4 Auto-Calculation Rules
The following values are **always computed, never manually entered**:
- `items[n].amount` = `items[n].unitPrice × items[n].qty`
- `subTotal` = `Σ items[n].amount`
- `taxAmount` = `subTotal × 0.18` (fixed 18% GST)
- `total` = `subTotal + taxAmount`

These are computed client-side in real-time as the admin types. On save, the computed values are written to Firestore as stored snapshots (so the PDF always reflects the exact amounts at time of creation, immune to future tax rate changes).

### 1.5 Invoice Number Generation
Invoice numbers are sequential integers (`1`, `2`, `3`…). On creation, the service function queries the `invoices` collection for the highest existing `invoiceNumber` and increments by 1. This query must be wrapped in a Firestore transaction to prevent race conditions if two admins create invoices simultaneously.

---

## 2. Firestore Schema — `invoices` Collection

### 2.1 `invoices/{invoiceId}` — Full Document Schema

```
invoices/{invoiceId}
  │
  ├── // ── Identity & Tracking ──────────────────────────────────────────────
  ├── invoiceId:          string      // Auto-generated Firestore document ID
  ├── invoiceNumber:      number      // Sequential integer: 1, 2, 3…
  │                                  // Displayed as "#1", "#2", etc.
  ├── invoiceDate:        Timestamp   // Date admin sets on the form (not createdAt)
  │                                  // Stored as Firestore Timestamp for sorting
  ├── status:             string      // "draft" | "sent" | "paid" | "overdue"
  │                                  // Default: "draft" on creation
  │
  ├── // ── Origin Tracking ─────────────────────────────────────────────────
  ├── projectId:          string | null   // null = made from scratch
  ├── projectTitle:       string | null   // Denormalized for display without extra fetch
  ├── origin:             string      // "scratch" | "project"
  │
  ├── // ── Company Info (Wavelet's own details — pre-filled from config) ────
  ├── company: {
  │     name:             string      // e.g. "Wavelet Software Services LLP"
  │     addressLine1:     string      // e.g. "43 FL-303, Ram Sita Ghat Street"
  │     addressLine2:     string      // e.g. "Uttarpara Bazar, Hoogly, West Bengal"
  │     pincode:          string      // e.g. "712232"
  │     phoneNumbers:     string[]    // Array — any number of phones allowed
  │     website:          string      // e.g. "thewavelet.in"
  │     gstNumber:        string      // e.g. "19AAFFW4553R1Z9"
  │     logoUrl:          string | null   // Firebase Storage URL for company logo
  │   }
  │
  ├── // ── Client Info (Bill To) ────────────────────────────────────────────
  ├── client: {
  │     name:             string      // Client / company name
  │     phoneNumber:      string      // Client contact phone
  │   }
  │
  ├── // ── Line Items ───────────────────────────────────────────────────────
  ├── items: [                        // Array of line item objects
  │     {
  │       description:    string      // Item & Description column
  │       unitPrice:      number      // ₹ per unit
  │       qty:            number      // Quantity (integer)
  │       amount:         number      // Computed: unitPrice × qty (stored snapshot)
  │     }
  │   ]
  │
  ├── // ── Financial Totals (stored snapshots — computed at save time) ───────
  ├── subTotal:           number      // Σ items[n].amount
  ├── taxRate:            number      // 0.18 — stored so future rate changes don't
  │                                  // retroactively alter old invoices
  ├── taxAmount:          number      // subTotal × taxRate
  ├── total:              number      // subTotal + taxAmount
  │
  ├── // ── Notes & Terms ────────────────────────────────────────────────────
  ├── notesTerms:         string      // e.g. "Payment is due within 15 days…"
  │
  ├── // ── Payment Method ───────────────────────────────────────────────────
  ├── payment: {
  │     bankName:         string      // e.g. "IDBI Bank"
  │     accountName:      string      // e.g. "Sayantan Kundu"
  │     accountNumber:    string      // e.g. "1526104000052508"
  │     ifscCode:         string      // e.g. "IBKL0000400"
  │     upiNumber:        string      // e.g. "96741 62655"
  │   }
  │
  ├── // ── Prepared By ──────────────────────────────────────────────────────
  ├── preparedBy: {
  │     name:             string      // e.g. "Sayantan Kundu"
  │     designation:      string      // e.g. "Founder, Wavelet Software Services LLP"
  │   }
  │
  ├── // ── Metadata ─────────────────────────────────────────────────────────
  ├── createdAt:          Timestamp   // serverTimestamp() on creation
  ├── createdBy:          string      // uid of admin who created
  ├── updatedAt:          Timestamp   // serverTimestamp() on every update
  ├── updatedBy:          string      // uid of admin who last updated
  └── isDeleted:          boolean     // Soft-delete flag — never hard-delete
```

---

### 2.2 Company Defaults Configuration

To avoid re-entering company details on every invoice, store a singleton config document:

```
app_config/company_defaults
  ├── company: { ...same shape as invoices/{id}.company }
  └── payment: { ...same shape as invoices/{id}.payment }
  └── preparedBy: { name, designation }
  └── notesTerms: string    // Default notes text
```

On `<InvoiceFormModal />` mount, fetch `app_config/company_defaults` once (not `onSnapshot` — this is a stable config). Pre-fill the company, payment, and preparedBy sections. Admins can override per-invoice. A separate "Company Settings" sub-page (out of scope for this blueprint) can update these defaults.

---

### 2.3 Invoice Status Flow

```
"draft" ──► "sent" ──► "paid"
  │
  └──► "overdue"   (can be set from "sent" if past due date)
```

Status is updated manually by the admin via a status dropdown on the `<InvoiceCard />`. No automated status transitions are required in this version.

---

### 2.4 Required Firestore Indexes — `firestore.indexes.json`

```json
[
  {
    "collectionGroup": "invoices",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted",     "order": "ASCENDING" },
      { "fieldPath": "createdAt",     "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "invoices",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted",     "order": "ASCENDING" },
      { "fieldPath": "projectId",     "order": "ASCENDING" },
      { "fieldPath": "createdAt",     "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "invoices",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isDeleted",     "order": "ASCENDING" },
      { "fieldPath": "status",        "order": "ASCENDING" },
      { "fieldPath": "createdAt",     "order": "DESCENDING" }
    ]
  }
]
```

---

## 3. State Management & Data Layer

### 3.1 `useInvoices.js` — Real-Time Hook

**File:** `src/hooks/useInvoices.js`

```js
import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Real-time listener for the invoices collection.
 * Filters out soft-deleted invoices.
 * Optionally filters by projectId for project-scoped views.
 *
 * @param {{ projectId?: string | null, status?: string | null }} filters
 * @returns {{ invoices, loading, error }}
 */
export function useInvoices(filters = {}) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    const constraints = [
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc'),
    ];

    if (filters.projectId !== undefined) {
      constraints.unshift(where('projectId', '==', filters.projectId));
    }
    if (filters.status) {
      constraints.unshift(where('status', '==', filters.status));
    }

    const q = query(collection(db, 'invoices'), ...constraints);

    const unsub = onSnapshot(
      q,
      (snap) => {
        setInvoices(snap.docs.map(d => ({ invoiceId: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[useInvoices]', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [filters.projectId, filters.status]);

  return { invoices, loading, error };
}
```

---

### 3.2 `invoiceService.js` — Data Service

**File:** `src/services/invoiceService.js`

```js
import {
  collection, doc, addDoc, updateDoc, runTransaction,
  serverTimestamp, query, orderBy, limit, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: Compute all financial totals from a raw items array.
// Call before every create/update to ensure stored values are always correct.
// ─────────────────────────────────────────────────────────────────────────────
export function computeInvoiceTotals(items) {
  const subTotal  = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
  const taxRate   = 0.18;
  const taxAmount = parseFloat((subTotal * taxRate).toFixed(2));
  const total     = parseFloat((subTotal + taxAmount).toFixed(2));
  return { subTotal: parseFloat(subTotal.toFixed(2)), taxRate, taxAmount, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE INVOICE
// Uses a Firestore transaction to safely generate the next sequential
// invoice number without race conditions.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} formData   - Validated form data from InvoiceFormModal
 * @param {string} adminUid
 * @param {string} adminName
 * @returns {Promise<string>} - New invoiceId
 */
export async function createInvoice(formData, adminUid, adminName) {
  const invoicesCol = collection(db, 'invoices');

  return await runTransaction(db, async (transaction) => {
    // Step 1: Determine the next invoice number
    // Query outside the transaction (read-only, acceptable for sequential IDs
    // with low concurrency). For high-concurrency, use a counter doc instead.
    const latestQ   = query(invoicesCol, orderBy('invoiceNumber', 'desc'), limit(1));
    const latestSnap = await getDocs(latestQ);
    const nextNumber = latestSnap.empty
      ? 1
      : (latestSnap.docs[0].data().invoiceNumber ?? 0) + 1;

    // Step 2: Compute financial totals
    const itemsWithAmounts = formData.items.map(item => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      qty:       Number(item.qty),
      amount:    parseFloat((Number(item.unitPrice) * Number(item.qty)).toFixed(2)),
    }));
    const totals = computeInvoiceTotals(itemsWithAmounts);

    // Step 3: Build the document payload
    const newDocRef = doc(invoicesCol);
    const payload = {
      invoiceId:     newDocRef.id,
      invoiceNumber: nextNumber,
      invoiceDate:   formData.invoiceDate,          // Timestamp from form
      status:        'draft',
      projectId:     formData.projectId   ?? null,
      projectTitle:  formData.projectTitle ?? null,
      origin:        formData.projectId ? 'project' : 'scratch',
      company:       formData.company,
      client:        formData.client,
      items:         itemsWithAmounts,
      ...totals,
      notesTerms:    formData.notesTerms  ?? '',
      payment:       formData.payment,
      preparedBy:    formData.preparedBy,
      createdAt:     serverTimestamp(),
      createdBy:     adminUid,
      updatedAt:     serverTimestamp(),
      updatedBy:     adminUid,
      isDeleted:     false,
    };

    transaction.set(newDocRef, payload);
    return newDocRef.id;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE INVOICE
// Recalculates all financial totals on every update.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {string} invoiceId
 * @param {object} formData   - Partial or full form data to update
 * @param {string} adminUid
 */
export async function updateInvoice(invoiceId, formData, adminUid) {
  const invoiceRef = doc(db, 'invoices', invoiceId);

  const itemsWithAmounts = formData.items.map(item => ({
    ...item,
    unitPrice: Number(item.unitPrice),
    qty:       Number(item.qty),
    amount:    parseFloat((Number(item.unitPrice) * Number(item.qty)).toFixed(2)),
  }));
  const totals = computeInvoiceTotals(itemsWithAmounts);

  await updateDoc(invoiceRef, {
    ...formData,
    items:     itemsWithAmounts,
    ...totals,
    updatedAt: serverTimestamp(),
    updatedBy: adminUid,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE STATUS ONLY
// Lightweight update for status changes from the InvoiceCard.
// ─────────────────────────────────────────────────────────────────────────────
export async function updateInvoiceStatus(invoiceId, newStatus, adminUid) {
  await updateDoc(doc(db, 'invoices', invoiceId), {
    status:    newStatus,
    updatedAt: serverTimestamp(),
    updatedBy: adminUid,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT DELETE INVOICE
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteInvoice(invoiceId, adminUid) {
  await updateDoc(doc(db, 'invoices', invoiceId), {
    isDeleted: true,
    updatedAt: serverTimestamp(),
    updatedBy: adminUid,
  });
}
```

---

## 4. UI Component Architecture

### 4.1 `InvoicesPage.jsx` — Main Route

**File:** `src/pages/Invoices/InvoicesPage.jsx`
**Route:** `/invoices`

**Responsibilities:**
- Admin-only route guard.
- Owns `useInvoices()` — the global `onSnapshot` subscriber.
- Manages `selectedInvoice` state (for expansion/editing) and `isFormOpen` state.
- Renders the toolbar, filter controls, metrics summary, and the invoice grid.

**Layout:**
```
┌──────────────────────────────────────────────────────────────────┐
│  Invoices                              [+ New Invoice]           │
│──────────────────────────────────────────────────────────────────│
│  <InvoiceMetricsBar />                                           │
│  (Total: N | Draft: N | Sent: N | Paid: N | Overdue: N)         │
│──────────────────────────────────────────────────────────────────│
│  Filters: [Status ▾] [Origin ▾] [Search by client/project...]   │
│──────────────────────────────────────────────────────────────────│
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ InvoiceCard  │  │ InvoiceCard  │  │ InvoiceCard  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ InvoiceCard  │  │ InvoiceCard  │  │ InvoiceCard  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

**Client-side filtering** (applied over the `onSnapshot` data — no secondary Firestore queries):
```js
const filtered = useMemo(() => invoices.filter(inv => {
  const matchesStatus = !statusFilter || inv.status === statusFilter;
  const matchesOrigin = !originFilter || inv.origin === originFilter;
  const matchesSearch = !searchQuery ||
    inv.client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.projectTitle?.toLowerCase().includes(searchQuery.toLowerCase());
  return matchesStatus && matchesOrigin && matchesSearch;
}), [invoices, statusFilter, originFilter, searchQuery]);
```

---

### 4.2 `<InvoiceMetricsBar />`

**File:** `src/pages/Invoices/InvoiceMetricsBar.jsx`

Five metric tiles derived from the full `invoices` array (no extra Firestore queries):

| Metric | Derivation |
|--------|-----------|
| Total Invoices | `invoices.length` |
| Draft | count where `status === 'draft'` |
| Sent | count where `status === 'sent'` |
| Paid | count where `status === 'paid'` |
| Total Billed | `formatINR(invoices.reduce((s,i) => s + i.total, 0))` |

---

### 4.3 `<InvoiceCard />`

**File:** `src/components/invoices/InvoiceCard.jsx`

A responsive card. Collapsed by default, expands on click to show full details.

**Collapsed state:**
```
┌──────────────────────────────────────────────────────────┐
│  #[invoiceNumber]                      [Status Chip]     │
│  [clientName]                          ₹[total]          │
│  [invoiceDate formatted DD/MM/YYYY]                      │
│  [Origin badge: "From Project: [title]" OR "Scratch"]   │
└──────────────────────────────────────────────────────────┘
```

**Expanded state** (renders below the collapsed header without a modal):
```
┌──────────────────────────────────────────────────────────┐
│  [Collapsed header — always visible]                     │
│──────────────────────────────────────────────────────────│
│  Company: [name]  |  GST: [gstNumber]                    │
│  Bill To: [clientName]  |  Phone: [clientPhone]          │
│──────────────────────────────────────────────────────────│
│  Item & Description    | Unit Price | Qty | Amount       │
│  [desc]                | ₹[price]   | [q] | ₹[amount]   │
│  [desc]                | ₹[price]   | [q] | ₹[amount]   │
│──────────────────────────────────────────────────────────│
│                        Sub-Total:  ₹[subTotal]           │
│                        Tax (18%):  ₹[taxAmount]          │
│                        Total:      ₹[total]  (bold)      │
│──────────────────────────────────────────────────────────│
│  Notes: [notesTerms]                                     │
│  Payment: [bankName] | [accountNumber] | [ifscCode]      │
│           UPI: [upiNumber]                               │
│──────────────────────────────────────────────────────────│
│  [Status: ▾ Dropdown]  [✏ Edit]  [⬇ Download PDF]  [🗑] │
└──────────────────────────────────────────────────────────┘
```

**Status chip colors:**
- `draft` → grey
- `sent` → blue
- `paid` → green
- `overdue` → red

**Action buttons in expanded state:**
- **Status dropdown** → calls `updateInvoiceStatus(invoiceId, newStatus, adminUid)`
- **✏ Edit** → opens `<InvoiceFormModal />` pre-filled with this invoice's data
- **⬇ Download PDF** → calls `generateAndDownloadPDF(invoice)` (see §5)
- **🗑 Delete** → confirmation dialog → calls `deleteInvoice(invoiceId, adminUid)`

---

### 4.4 `<InvoiceFormModal />` — The Core Form

**File:** `src/components/invoices/InvoiceFormModal.jsx`

This is the most complex component in the module. Uses `react-hook-form` with `useFieldArray` for the dynamic line-item table.

#### 4.4.1 Form Initialization

```js
import { useForm, useFieldArray, useWatch } from 'react-hook-form';

const { control, register, handleSubmit, setValue, formState: { errors } } = useForm({
  defaultValues: prefillData ?? {
    invoiceDate:  new Date(),
    company:      companyDefaults.company,   // from app_config/company_defaults
    client:       { name: '', phoneNumber: '' },
    items:        [{ description: '', unitPrice: 0, qty: 1, amount: 0 }],
    notesTerms:   companyDefaults.notesTerms,
    payment:      companyDefaults.payment,
    preparedBy:   companyDefaults.preparedBy,
    projectId:    null,
    projectTitle: null,
  }
});

const { fields, append, remove } = useFieldArray({ control, name: 'items' });
```

**`prefillData`** is passed as a prop when the modal is opened from either:
- `<InvoiceCard />` (editing an existing invoice) — full existing document
- `<ProjectDashboardCard />` (new invoice from project) — partial prefill (see §6)

#### 4.4.2 Real-Time Total Calculation

Use `useWatch` to observe the `items` array and recompute totals on every keystroke without triggering a full re-render of the form:

```js
// Mount a watched computation outside the render cycle
const watchedItems = useWatch({ control, name: 'items' });

const liveTotals = useMemo(() => {
  const subTotal  = watchedItems.reduce((sum, item) => {
    return sum + (Number(item.unitPrice || 0) * Number(item.qty || 0));
  }, 0);
  const taxAmount = subTotal * 0.18;
  return {
    subTotal:  subTotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total:     (subTotal + taxAmount).toFixed(2),
  };
}, [watchedItems]);

// Each row's amount is also computed and displayed via useWatch:
// items[index].amount = items[index].unitPrice * items[index].qty
// This is a display-only computed value — never registered as an input.
```

#### 4.4.3 Modal Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  New Invoice  /  Edit Invoice #[N]                   [✕ Close]  │
│─────────────────────────────────────────────────────────────────│
│  SECTION 1: Invoice Details                                      │
│  Invoice Number: [auto-generated, read-only]                     │
│  Invoice Date:   [date picker]                                   │
│─────────────────────────────────────────────────────────────────│
│  SECTION 2: Company Info                                         │
│  Name / Address / Pincode / Phones (dynamic list) /             │
│  Website / GST Number / Logo Upload                              │
│─────────────────────────────────────────────────────────────────│
│  SECTION 3: Bill To                                              │
│  Client Name / Phone Number                                      │
│  (pre-filled if from project)                                    │
│─────────────────────────────────────────────────────────────────│
│  SECTION 4: Line Items                                           │
│  ┌──────────────────────┬────────────┬─────┬──────────┬───┐    │
│  │ Description          │ Unit Price │ Qty │ Amount   │   │    │
│  ├──────────────────────┼────────────┼─────┼──────────┼───┤    │
│  │ [text input]         │ [number]   │ [#] │ ₹[auto]  │ × │    │
│  │ [text input]         │ [number]   │ [#] │ ₹[auto]  │ × │    │
│  └──────────────────────┴────────────┴─────┴──────────┴───┘    │
│  [+ Add Item Row]                                                │
│─────────────────────────────────────────────────────────────────│
│  SECTION 5: Totals (read-only, live computed)                    │
│                    Sub-Total:  ₹[subTotal]                       │
│                    Tax (18%):  ₹[taxAmount]                      │
│                    Total:      ₹[total]  (bold)                  │
│─────────────────────────────────────────────────────────────────│
│  SECTION 6: Notes / Terms  [textarea]                            │
│─────────────────────────────────────────────────────────────────│
│  SECTION 7: Payment Method                                       │
│  Bank / Account Name / Account No. / IFSC / UPI                 │
│─────────────────────────────────────────────────────────────────│
│  SECTION 8: Prepared By                                          │
│  Name / Designation                                              │
│─────────────────────────────────────────────────────────────────│
│  [Cancel]                              [Save as Draft] [Save]   │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.4.4 Dynamic Phone Numbers in Company Section

The company phone numbers field supports multiple entries. Use a second nested `useFieldArray`:

```js
const { fields: phoneFields, append: addPhone, remove: removePhone } =
  useFieldArray({ control, name: 'company.phoneNumbers' });
```

Each phone entry is a text input with a remove (×) button. An "+ Add Phone" button appends a new empty entry. Minimum 1 phone number enforced via validation.

#### 4.4.5 Form Submission

```js
const onSubmit = async (formData) => {
  setSubmitting(true);
  try {
    if (isEditing) {
      await updateInvoice(invoice.invoiceId, formData, currentUser.uid);
    } else {
      await createInvoice(formData, currentUser.uid, currentUser.displayName);
    }
    closeModal();
  } catch (err) {
    setSubmitError(err.message);
  } finally {
    setSubmitting(false);
  }
};
```

---

## 5. PDF Generation Strategy

### 5.1 Library

Use `@react-pdf/renderer` for PDF generation. This library renders React components into a PDF binary in the browser — no server required.

**Installation:**
```bash
npm install @react-pdf/renderer
```

**Critical note:** `@react-pdf/renderer` has its own layout engine and does not use Tailwind or HTML. All styles within PDF components use the library's `StyleSheet.create()` API with a React Native-like style model (flexbox-only, no grid, no CSS variables). Never import Tailwind classes into PDF components.

---

### 5.2 `InvoicePDFTemplate.jsx` — The PDF Document Component

**File:** `src/components/invoices/pdf/InvoicePDFTemplate.jsx`

This component accepts a full `invoice` document object as a prop and renders the PDF structure that exactly matches the provided Wavelet invoice PDF.

#### 5.2.1 Visual Structure Mapping (PDF → PDF Component)

```
INVOICE PDF (Wavelet Template)               → PDF COMPONENT TREE
─────────────────────────────────────────────────────────────────
┌─────────────────────────────────────────┐
│ "INVOICE" (large bold, left)            → <HeaderSection />
│                         [WAVELET LOGO]  →   <Image src={logoUrl} />
│ Invoice Number: #2                      →   <Text>Invoice Number: #{n}</Text>
│ Invoice Date: 01/01/2026                →   <Text>Invoice Date: {date}</Text>
├────────────────────┬────────────────────┤
│ COMPANY INFO       │ BILL TO            → <BillingSection />
│ Wavelet Software   │ MIND & SPACE       →   Two <View> columns side by side
│ [address block]    │ +91 XXXXX XXXXX    →   using flexDirection: 'row'
│ GST No.:           │                    │
├────────────────────┴────────────────────┤
│ ┌──────────────┬──────────┬────┬──────┐ → <ItemsTable />
│ │Item & Desc   │Unit Price│Qty │Amount│ →   <TableHeader /> row (grey bg)
│ ├──────────────┼──────────┼────┼──────┤ →   <TableRow /> × N items
│ │[description] │Rs XXXX   │  1 │Rs XXX│
│ └──────────────┴──────────┴────┴──────┘
├─────────────────────────────────────────┤
│                    Sub-Total │ Rs XXXX  → <TotalsSection />
│                    Tax (18%) │ Rs XXXX  →   Right-aligned two-column block
│                    Total     │ Rs XXXX  →   Total row in bold
├─────────────────────────────────────────┤
│ NOTES / TERMS:                          → <NotesSection />
│ Payment is due within 15 days…          →   <Text> wrapping content
├────────────────────┬────────────────────┤
│ PAYMENT METHOD     │ PREPARED BY        → <FooterSection />
│ Bank: IDBI         │ Sayantan Kundu     →   Two <View> columns
│ Acc Name: …        │ Founder, Wavelet…  →   flexDirection: 'row'
│ Account No.: …     │
│ IFSC: …            │
│ PhonePe No.: …     │
└────────────────────┴────────────────────┘
```

#### 5.2.2 StyleSheet Reference

```js
// src/components/invoices/pdf/pdfStyles.js
import { StyleSheet } from '@react-pdf/renderer';

// Color palette matching the Wavelet invoice PDF
const COLORS = {
  black:      '#000000',
  darkGrey:   '#333333',
  mediumGrey: '#666666',
  lightGrey:  '#f2f2f2',
  headerBg:   '#1a1a2e',   // Dark navy for table header (match PDF)
  headerText: '#ffffff',
  accent:     '#e8b84b',   // Wavelet gold accent (from logo)
  border:     '#dddddd',
};

export const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.darkGrey,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  invoiceTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.black,
  },
  logo: {
    width: 100,
    height: 40,
    objectFit: 'contain',
  },
  invoiceMeta: {
    fontSize: 10,
    color: COLORS.mediumGrey,
    marginTop: 4,
  },

  // ── Company / Bill To ────────────────────────────────────────────────────
  billingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: `1pt solid ${COLORS.border}`,
  },
  billingColumn: { width: '48%' },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    color: COLORS.black,
    textTransform: 'uppercase',
  },
  bodyText: { fontSize: 10, lineHeight: 1.5, color: COLORS.darkGrey },

  // ── Items Table ──────────────────────────────────────────────────────────
  table: { width: '100%', marginBottom: 16 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.headerBg,
    padding: '6pt 8pt',
  },
  tableHeaderCell: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.headerText,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${COLORS.border}`,
    padding: '5pt 8pt',
  },
  tableRowAlt: {
    backgroundColor: COLORS.lightGrey,  // Zebra striping for alternate rows
  },
  // Column widths (must sum to 100%)
  colDescription: { width: '50%' },
  colUnitPrice:   { width: '20%' },
  colQty:         { width: '10%' },
  colAmount:      { width: '20%', textAlign: 'right' },

  // ── Totals ───────────────────────────────────────────────────────────────
  totalsSection: {
    alignSelf: 'flex-end',
    width: '40%',
    marginBottom: 20,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalsLabel: { fontSize: 10, color: COLORS.darkGrey },
  totalsValue:  { fontSize: 10, textAlign: 'right' },
  totalsBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: COLORS.black,
    borderTop: `1pt solid ${COLORS.black}`,
    paddingTop: 4,
    marginTop: 4,
  },

  // ── Notes ────────────────────────────────────────────────────────────────
  notesSection: { marginBottom: 24 },

  // ── Footer ───────────────────────────────────────────────────────────────
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTop: `1pt solid ${COLORS.border}`,
  },
  footerColumn: { width: '48%' },
});
```

#### 5.2.3 Full Component Structure

```jsx
// src/components/invoices/pdf/InvoicePDFTemplate.jsx
import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { styles } from './pdfStyles';

// ── Currency formatter for PDF context (can't import browser formatINR) ───
const fmtINR = (n) => `Rs ${Number(n ?? 0).toLocaleString('en-IN', {
  minimumFractionDigits: 2, maximumFractionDigits: 2
})}`;

export function InvoicePDFTemplate({ invoice }) {
  const { company, client, items, payment, preparedBy } = invoice;

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceMeta}>Invoice Number: #{invoice.invoiceNumber}</Text>
            <Text style={styles.invoiceMeta}>
              Invoice Date: {invoice.invoiceDate?.toDate
                ? invoice.invoiceDate.toDate().toLocaleDateString('en-IN')
                : invoice.invoiceDate}
            </Text>
          </View>
          {company.logoUrl
            ? <Image src={company.logoUrl} style={styles.logo} />
            : <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold' }}>{company.name}</Text>
          }
        </View>

        {/* ── COMPANY + BILL TO ──────────────────────────────────────── */}
        <View style={styles.billingRow}>
          {/* Company (left column) */}
          <View style={styles.billingColumn}>
            <Text style={styles.sectionLabel}>{company.name}</Text>
            <Text style={styles.bodyText}>{company.addressLine1}</Text>
            <Text style={styles.bodyText}>{company.addressLine2}</Text>
            <Text style={styles.bodyText}>Pin Code: {company.pincode}</Text>
            {company.phoneNumbers.map((ph, i) => (
              <Text key={i} style={styles.bodyText}>{ph}</Text>
            ))}
            <Text style={styles.bodyText}>{company.website}</Text>
            <Text style={styles.bodyText}>GST No. : {company.gstNumber}</Text>
          </View>

          {/* Bill To (right column) */}
          <View style={styles.billingColumn}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <Text style={[styles.bodyText, { fontFamily: 'Helvetica-Bold' }]}>
              {client.name}
            </Text>
            <Text style={styles.bodyText}>{client.phoneNumber}</Text>
          </View>
        </View>

        {/* ── ITEMS TABLE ────────────────────────────────────────────── */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>Item &amp; Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colUnitPrice]}>Unit Price</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
          </View>

          {/* Table Rows */}
          {items.map((item, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.bodyText, styles.colDescription]}>{item.description}</Text>
              <Text style={[styles.bodyText, styles.colUnitPrice]}>{fmtINR(item.unitPrice)}</Text>
              <Text style={[styles.bodyText, styles.colQty]}>{item.qty}</Text>
              <Text style={[styles.bodyText, styles.colAmount]}>{fmtINR(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* ── TOTALS ─────────────────────────────────────────────────── */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Sub-Total</Text>
            <Text style={styles.totalsValue}>{fmtINR(invoice.subTotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Tax (18%)</Text>
            <Text style={styles.totalsValue}>{fmtINR(invoice.taxAmount)}</Text>
          </View>
          <View style={[styles.totalsRow, styles.totalsBold]}>
            <Text>Total</Text>
            <Text>{fmtINR(invoice.total)}</Text>
          </View>
        </View>

        {/* ── NOTES / TERMS ──────────────────────────────────────────── */}
        {invoice.notesTerms ? (
          <View style={styles.notesSection}>
            <Text style={styles.sectionLabel}>Notes / Terms:</Text>
            <Text style={styles.bodyText}>{invoice.notesTerms}</Text>
          </View>
        ) : null}

        {/* ── PAYMENT METHOD + PREPARED BY ───────────────────────────── */}
        <View style={styles.footerRow}>
          <View style={styles.footerColumn}>
            <Text style={styles.sectionLabel}>Payment Method</Text>
            <Text style={styles.bodyText}>Bank: {payment.bankName}</Text>
            <Text style={styles.bodyText}>Account Name: {payment.accountName}</Text>
            <Text style={styles.bodyText}>Account No. : {payment.accountNumber}</Text>
            <Text style={styles.bodyText}>IFSC Code: {payment.ifscCode}</Text>
            <Text style={styles.bodyText}>PhonePe No. : {payment.upiNumber}</Text>
          </View>
          <View style={styles.footerColumn}>
            <Text style={styles.sectionLabel}>Prepared By</Text>
            <Text style={[styles.bodyText, { fontFamily: 'Helvetica-Bold' }]}>
              {preparedBy.name}
            </Text>
            <Text style={styles.bodyText}>{preparedBy.designation}</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
```

---

### 5.3 PDF Download Trigger

**File:** `src/utils/downloadInvoicePDF.js`

Use `@react-pdf/renderer`'s `pdf()` function to generate the PDF blob in the browser and trigger a download — no external service, no backend call:

```js
import { pdf } from '@react-pdf/renderer';
import { InvoicePDFTemplate } from '../components/invoices/pdf/InvoicePDFTemplate';
import React from 'react';

/**
 * Generates the PDF from an invoice document and triggers a browser download.
 * @param {object} invoice - Full invoice document from Firestore
 */
export async function generateAndDownloadPDF(invoice) {
  const fileName = `Wavelet_Invoice_${invoice.invoiceNumber}_${invoice.client.name.replace(/\s+/g, '_')}.pdf`;

  const blob = await pdf(
    <InvoicePDFTemplate invoice={invoice} />
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

This function is called from the `[⬇ Download PDF]` button inside `<InvoiceCard />`.

---

## 6. Integration Points — ProjectDashboardCard

### 6.1 The "Generate Invoice" Button

**File to modify:** `src/components/dashboard/ProjectDashboardCard.jsx`

This is a **surgical, minimal change** to the existing component. Add a single button inside the expanded left column, beneath the Live Financial Breakdown section, visible to Admin only.

```jsx
{/* Inside the expanded left column, Admin only */}
{isAdmin && (
  <div className="mt-4 pt-4 border-t border-gray-200">
    <button
      onClick={() => handleGenerateInvoice(project)}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700
                 transition-colors"
    >
      <FileText size={16} />   {/* Lucide icon */}
      Generate Invoice
    </button>
  </div>
)}
```

### 6.2 Pre-Fill Data Assembly

When the admin clicks "Generate Invoice" on a project card, the handler must:

1. Assemble the `prefillData` object from the project document.
2. Fetch the project's financial data from `useProjectFinancials` (already available as a hook in the existing codebase).
3. Navigate to `/invoices` and open `<InvoiceFormModal />` with `prefillData`.

```js
// src/components/dashboard/ProjectDashboardCard.jsx

const handleGenerateInvoice = (project) => {
  // Assemble prefillData for the invoice form
  const prefillData = {
    // Origin tracking
    projectId:    project.id,
    projectTitle: project.title,
    origin:       'project',

    // Pre-fill client details from the project document
    client: {
      name:        project.clientName  ?? '',
      phoneNumber: project.clientPhone ?? '',
    },

    // Pre-fill one line item from the project's financial data
    // The admin can edit/add/remove items in the form
    items: [
      {
        description: project.title,
        unitPrice:   project.estimatedBilling ?? 0,
        qty:         1,
        amount:      project.estimatedBilling ?? 0,
      }
    ],

    // Company, payment, preparedBy come from app_config/company_defaults
    // and are loaded inside InvoiceFormModal on mount — not passed here
  };

  // Use React Router's navigate + state to pass prefillData to InvoicesPage
  navigate('/invoices', { state: { openForm: true, prefillData } });
};
```

### 6.3 Receiving the Pre-Fill in InvoicesPage

```js
// src/pages/Invoices/InvoicesPage.jsx
import { useLocation } from 'react-router-dom';

const location = useLocation();

useEffect(() => {
  if (location.state?.openForm) {
    setFormPrefill(location.state.prefillData ?? null);
    setIsFormOpen(true);
    // Clear the navigation state so a refresh doesn't re-open the form
    window.history.replaceState({}, '', '/invoices');
  }
}, [location.state]);
```

### 6.4 Project Card — Invoice History Badge

Optionally, add a small badge on the project card showing how many invoices have been generated for this project. Use the `useInvoices` hook scoped to `projectId`:

```js
// Inside ProjectDashboardCard — only runs when card is expanded
const { invoices: projectInvoices } = useInvoices({ projectId: project.id });

// Display
{projectInvoices.length > 0 && (
  <span className="text-xs text-gray-500">
    {projectInvoices.length} invoice{projectInvoices.length !== 1 ? 's' : ''} generated
  </span>
)}
```

---

## 7. Security Rules Additions

Append to `firestore.rules`:

```javascript
// ── invoices collection ──────────────────────────────────────────────────────
match /invoices/{invoiceId} {

  // Only admins and super_admins can read invoices. Workers have zero access.
  allow read: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ['admin', 'super_admin'];

  // Only admins can create invoices.
  // Enforce: isDeleted must be false on creation.
  allow create: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ['admin', 'super_admin'] &&
    request.resource.data.isDeleted == false;

  // Only admins can update invoices.
  // invoiceNumber is immutable after creation (receipt integrity).
  allow update: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ['admin', 'super_admin'] &&
    request.resource.data.invoiceNumber == resource.data.invoiceNumber;

  // Hard deletes forbidden. Soft delete via isDeleted: true (update rule above).
  allow delete: if false;
}

// ── app_config singleton ─────────────────────────────────────────────────────
match /app_config/{docId} {

  // All authenticated users can read config (needed if dashboard uses it)
  allow read: if request.auth != null;

  // Only super_admins can update company defaults
  allow write: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      == 'super_admin';
}
```

---

## 8. Package Dependencies

Run the following in the project root before implementation:

```bash
# PDF generation
npm install @react-pdf/renderer

# Already in stack (verify present, do not reinstall if already there):
# react-hook-form     — form state management & useFieldArray
# lucide-react        — icons (FileText, Download, Trash2, Edit, X)
# firebase            — Firestore, Auth
```

**`@react-pdf/renderer` compatibility note:** This library uses a Web Worker internally for PDF rendering. In a Vite project, add the following to `vite.config.js` to prevent build errors:

```js
// vite.config.js
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@react-pdf/renderer'],   // Exclude from Vite pre-bundling
  },
});
```

---

## 9. Component Tree Reference

```
<InvoicesPage />                           src/pages/Invoices/InvoicesPage.jsx
  │  owns: useInvoices() — global onSnapshot
  │  owns: isFormOpen, formPrefill, statusFilter, originFilter, searchQuery
  │  reads: useLocation() for project-card navigation state
  │
  ├── <InvoiceMetricsBar />                src/pages/Invoices/InvoiceMetricsBar.jsx
  │     Props: invoices[]
  │     Derives: total count, per-status counts, total billed (₹)
  │
  ├── [Filter toolbar]
  │     Status dropdown | Origin dropdown | Search input
  │
  ├── <InvoiceCard /> × N                 src/components/invoices/InvoiceCard.jsx
  │     Props: invoice, onEdit, onDelete, onStatusChange
  │     Collapsed: #number, client, total, status chip, origin badge
  │     Expanded: full details + action buttons
  │       ├── Status dropdown → updateInvoiceStatus()
  │       ├── [✏ Edit]       → opens InvoiceFormModal (edit mode)
  │       ├── [⬇ Download]   → generateAndDownloadPDF(invoice)
  │       └── [🗑 Delete]    → confirmation → deleteInvoice()
  │
  └── <InvoiceFormModal />                src/components/invoices/InvoiceFormModal.jsx
        Props: isOpen, onClose, prefillData (null for new)
        Uses: useForm, useFieldArray (react-hook-form)
        Uses: useWatch for real-time total computation
        Sections: Invoice Details | Company Info | Bill To |
                  Line Items (dynamic) | Totals (read-only) |
                  Notes | Payment Method | Prepared By
        Submits via: createInvoice() or updateInvoice()

PDF Layer (no Tailwind — @react-pdf/renderer only):
  <InvoicePDFTemplate />                  src/components/invoices/pdf/InvoicePDFTemplate.jsx
    Props: invoice (full document object)
    Children:
      <HeaderSection />     — "INVOICE" title, logo, invoice number & date
      <BillingSection />    — Company info (left) + Bill To (right)
      <ItemsTable />        — 4-column table with header + data rows
      <TotalsSection />     — Sub-Total, Tax, Total (right-aligned)
      <NotesSection />      — Notes/Terms text block
      <FooterSection />     — Payment Method (left) + Prepared By (right)

    Triggered by: generateAndDownloadPDF() utility
    Output: Browser file download (filename: Wavelet_Invoice_N_ClientName.pdf)

ProjectDashboardCard Integration:
  <ProjectDashboardCard />               MODIFIED (minimal change)
    └── [Generate Invoice] button        — Admin only, in expanded left column
          onClick: handleGenerateInvoice(project)
          Action: navigate('/invoices', { state: { openForm: true, prefillData } })
```

**New files created by this module:**

```
src/
├── pages/Invoices/
│   ├── InvoicesPage.jsx
│   └── InvoiceMetricsBar.jsx
├── components/invoices/
│   ├── InvoiceCard.jsx
│   ├── InvoiceFormModal.jsx
│   └── pdf/
│       ├── InvoicePDFTemplate.jsx
│       └── pdfStyles.js
├── hooks/
│   └── useInvoices.js
├── services/
│   └── invoiceService.js
└── utils/
    └── downloadInvoicePDF.js
```
