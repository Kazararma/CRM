# Proposal Feature Blueprint
### Wavelet CRM · Opportunities Module — Proposal Phase Enhancement
#### `proposal-feature-blueprint.md`

> **Agent Directive:** This document is your complete, self-contained implementation guide for the Proposal PDF feature inside `ProposalStage.jsx`. Read every section before writing a single line of code. All changes are strictly additive to the existing `ProposalStage.jsx`. The existing fields (`moneyAskedFromClient`, `initialPaymentAmount`, `contractStartDate`, `contractEndDate`, `contractTermsDetails`) must remain fully intact and operational. Do not rename, remove, or restructure any existing state, prop, or Firestore field.

---

## Table of Contents
1. [Dependency Installation](#1-dependency-installation)
2. [Data Structures & State](#2-data-structures--state)
3. [Global Settings Integration](#3-global-settings-integration)
4. [Number-to-Words Utility](#4-number-to-words-utility)
5. [UI Implementation in ProposalStage.jsx](#5-ui-implementation-in-proposalstagejsx)
6. [PDF Generation Engine](#6-pdf-generation-engine)
7. [Email Dispatch Logic](#7-email-dispatch-logic)
8. [Firestore Schema Additions](#8-firestore-schema-additions)
9. [File & Module Structure](#9-file--module-structure)

---

## 1. Dependency Installation

Run in the project root. Do not modify `package.json` manually:

```bash
npm install jspdf jspdf-autotable
```

**Library roles:**

| Library | Version target | Purpose |
|---------|---------------|---------|
| `jspdf` | `^2.5.1` | Core PDF document engine. Handles page creation, text rendering, image embedding, and coordinate-based layout. |
| `jspdf-autotable` | `^3.8.2` | Plugin for `jspdf` that renders structured HTML/data tables into PDFs with automatic pagination, column sizing, and row striping. Must be imported after `jspdf`. |

**No Vite configuration changes required** for these libraries — they are pure browser-compatible JavaScript bundles.

---

## 2. Data Structures & State

### 2.1 New State Definitions for `ProposalStage.jsx`

All state below is **added** to the existing component. Existing state (`moneyAskedFromClient`, `initialPaymentAmount`, `contractStartDate`, `contractEndDate`, `contractTermsDetails`) is preserved without modification.

#### 2.1.1 Proposal Header Fields

```js
// Proposal metadata — displayed in the PDF header block
const [proposalCreationDate, setProposalCreationDate] = useState('');
// Type: string, format: 'YYYY-MM-DD' (HTML date input native value)
// Displayed in PDF as: formatted date string (DD/MM/YYYY)

const [proposalExpiryDate, setProposalExpiryDate]     = useState('');
// Type: string, format: 'YYYY-MM-DD'

const [paymentTerms, setPaymentTerms]                 = useState('');
// Type: string, e.g., "50% advance, 50% on delivery"

const [deliveryCompletion, setDeliveryCompletion]     = useState('');
// Type: string, e.g., "45 working days from project kick-off"

const [proposalTo, setProposalTo]                     = useState('');
// Type: string — recipient company name or person name

const [proposalDear, setProposalDear]                 = useState('');
// Type: string — salutation name, e.g., "Mr. Rajan Sharma"
```

#### 2.1.2 Billing To — Client Details

These are pre-populated from the opportunity document (inherited client data) but editable before PDF generation:

```js
const [billingName, setBillingName]               = useState('');
// Type: string — client contact person's name

const [billingCompanyName, setBillingCompanyName] = useState('');
// Type: string — client's company/organization name

const [billingAddress, setBillingAddress]         = useState('');
// Type: string — street address (multi-line rendered in PDF)

const [billingCity, setBillingCity]               = useState('');
// Type: string — city/locality

const [billingPincode, setBillingPincode]         = useState('');
// Type: string — postal code (kept as string to preserve leading zeros)

const [billingContactNumbers, setBillingContactNumbers] = useState('');
// Type: string — comma-separated phone numbers
// e.g., "+91 98765 43210, +91 70440 13301"
// PDF rendering: split by comma, render as individual lines

const [billingWebsite, setBillingWebsite]         = useState('');
// Type: string — client website URL

const [billingGstNo, setBillingGstNo]             = useState('');
// Type: string — client's GST registration number
```

**Pre-population logic** — run inside the existing `useEffect` that loads opportunity data, after the existing field assignments:

```js
// Inside the existing data-loading useEffect for the proposal stage:
// (Find the useEffect that maps opportunity.proposal.* fields to state)
// Add these lines at the END of that effect, guarded for null safety:

setBillingName(opportunity.clientName ?? '');
setBillingCompanyName(opportunity.clientName ?? '');
// Note: CRM stores clientName — admin can refine these before generating PDF

setProposalCreationDate(
  opportunity.proposal?.creationDate
    ? opportunity.proposal.creationDate
    : new Date().toISOString().split('T')[0]
);
setProposalExpiryDate(opportunity.proposal?.expiryDate ?? '');
setPaymentTerms(opportunity.proposal?.paymentTerms ?? '');
setDeliveryCompletion(opportunity.proposal?.deliveryCompletion ?? '');
setProposalTo(opportunity.proposal?.proposalTo ?? opportunity.clientName ?? '');
setProposalDear(opportunity.proposal?.proposalDear ?? '');
setBillingAddress(opportunity.proposal?.billingAddress ?? '');
setBillingCity(opportunity.proposal?.billingCity ?? '');
setBillingPincode(opportunity.proposal?.billingPincode ?? '');
setBillingContactNumbers(opportunity.proposal?.billingContactNumbers ?? opportunity.clientPhone ?? '');
setBillingWebsite(opportunity.proposal?.billingWebsite ?? '');
setBillingGstNo(opportunity.proposal?.billingGstNo ?? '');
```

#### 2.1.3 Line Items — Dynamic Rows

```js
/**
 * LineItem shape:
 * {
 *   id:          string  — crypto.randomUUID() generated on addRow()
 *   description: string  — "Item & Description" column
 *   unitPrice:   number  — ₹ per unit
 *   qty:         number  — integer quantity
 *   amount:      number  — COMPUTED: unitPrice × qty (never manually set)
 * }
 */
const [lineItems, setLineItems] = useState([
  { id: crypto.randomUUID(), description: '', unitPrice: 0, qty: 1, amount: 0 },
]);
// Default: one empty row so the table is never completely empty on first render.
```

**Line item mutation functions** — define these inside the component:

```js
// Add a new blank row
const addLineItemRow = () => {
  setLineItems(prev => [
    ...prev,
    { id: crypto.randomUUID(), description: '', unitPrice: 0, qty: 1, amount: 0 },
  ]);
};

// Remove a row by id — minimum 1 row must remain
const removeLineItemRow = (id) => {
  setLineItems(prev => {
    if (prev.length <= 1) return prev; // guard: never allow empty table
    return prev.filter(item => item.id !== id);
  });
};

// Update a cell within a row — recomputes amount automatically
const updateLineItem = (id, field, value) => {
  setLineItems(prev => prev.map(item => {
    if (item.id !== id) return item;
    const updated = { ...item, [field]: value };
    // Always recompute amount when unitPrice or qty changes
    updated.amount = parseFloat(
      (Number(updated.unitPrice || 0) * Number(updated.qty || 0)).toFixed(2)
    );
    return updated;
  }));
};
```

#### 2.1.4 Tax & Totals State

```js
const [useIgst, setUseIgst] = useState(false);
// Toggle: false = apply CGST (9%) + SGST (9%) separately
//         true  = apply IGST (18%) as a single line (inter-state transactions)
// Only one tax regime is active at a time — they are mutually exclusive.

const [specialTerms, setSpecialTerms] = useState('');
// Free-text paragraph for special conditions, warranty terms, freight terms, etc.
```

**Derived totals** — use `useMemo` so they recompute reactively whenever `lineItems` or `useIgst` changes. These are **never stored in React state** — they are always derived:

```js
import { useMemo } from 'react';

const subTotal = useMemo(
  () => lineItems.reduce((sum, item) => sum + (item.amount ?? 0), 0),
  [lineItems]
);

const cgst = useMemo(
  () => useIgst ? 0 : parseFloat((subTotal * 0.09).toFixed(2)),
  [subTotal, useIgst]
);

const sgst = useMemo(
  () => useIgst ? 0 : parseFloat((subTotal * 0.09).toFixed(2)),
  [subTotal, useIgst]
);

const igst = useMemo(
  () => useIgst ? parseFloat((subTotal * 0.18).toFixed(2)) : 0,
  [subTotal, useIgst]
);

const grandTotal = useMemo(
  () => parseFloat((subTotal + cgst + sgst + igst).toFixed(2)),
  [subTotal, cgst, sgst, igst]
);
```

#### 2.1.5 UI Control State

```js
const [isGeneratingPdf, setIsGeneratingPdf]   = useState(false);
// true while generateProposalPDF() is executing — disables button, shows spinner

const [isSendingEmail, setIsSendingEmail]     = useState(false);
// true while email dispatch is in progress

const [proposalError, setProposalError]       = useState(null);
// string | null — displayed below buttons on failure

const [showEmailModal, setShowEmailModal]     = useState(false);
// Controls visibility of the email confirmation modal
```

---

## 3. Global Settings Integration

### 3.1 Reference: Existing Settings Architecture

The existing `InvoiceSettingsModal.jsx` uses a `getInvoiceSettings()` function to fetch company-wide defaults from Firestore. The same function and the same Firestore document provide the company and payment details for the proposal PDF. **Do not duplicate this logic** — import and reuse it.

### 3.2 Settings Data Shape (consumed from `getInvoiceSettings()`)

The returned object has this structure (matches the `app_config/company_defaults` document):

```js
{
  company: {
    name:         string,      // "Wavelet Software Services LLP"
    addressLine1: string,      // "43 FL-303, Ram Sita Ghat Street"
    addressLine2: string,      // "Uttarpara Bazar, Hoogly, West Bengal"
    city:         string,      // "Hoogly"
    pincode:      string,      // "712232"
    gstNumber:    string,      // "19AAFFW4553R1Z9"
    phoneNumbers: string[],    // ["+91 70440 13301", "+91 96741 62655"]
    website:      string,      // "thewavelet.in"
    logoUrl:      string|null, // Firebase Storage URL or null
  },
  payment: {
    bankName:       string,    // "IDBI Bank"
    accountName:    string,    // "Sayantan Kundu"
    accountNumber:  string,    // "1526104000052508"
    ifscCode:       string,    // "IBKL0000400"
    upiNumber:      string,    // "96741 62655"
  },
  preparedBy: {
    signatureText:  string,    // "Sayantan Kundu, Founder, Wavelet Software Services LLP"
  }
}
```

### 3.3 Fetching Settings in `ProposalStage.jsx`

Add the following state and effect to the component. The settings are fetched once on mount and stored locally — they are used only for PDF generation and are not displayed in the form UI (the company's own details are not editable per-proposal; only the client billing details are):

```js
import { getInvoiceSettings } from '../../services/invoiceSettingsService';
// Adjust import path to match the existing file location in the project

const [companySettings, setCompanySettings] = useState(null);
// null while loading; populated after the one-time fetch

// Inside a dedicated useEffect (separate from the opportunity data loader):
useEffect(() => {
  getInvoiceSettings()
    .then(settings => setCompanySettings(settings))
    .catch(err => console.error('[ProposalStage] Failed to load company settings:', err));
}, []); // Empty dependency array — fetch once on mount
```

**Guard in PDF generation:** Before calling `generateProposalPDF()`, check:
```js
if (!companySettings) {
  setProposalError('Company settings not loaded. Please check Invoice Settings.');
  return;
}
```

---

## 4. Number-to-Words Utility

### 4.1 File Location

**File:** `src/utils/numberToWords.js`

This is a standalone pure utility. No external library is needed — implement it natively to avoid adding another dependency.

### 4.2 Function Signature

```js
/**
 * Converts a positive number to its Indian English word representation.
 * Handles Crores, Lakhs, Thousands, and sub-1000 values.
 *
 * @param {number} amount — The grand total (float or integer)
 * @returns {string}      — e.g., "Rupees Seven Thousand Eighty Only"
 *
 * Rules:
 * - Split into integer part and decimal (paise) part.
 * - Use Indian number system: ones, tens, hundreds, thousands,
 *   ten-thousands → lakhs, ten-lakhs, crores, ten-crores.
 * - Decimal part: if > 0, append "and XX Paise" to the output.
 * - Always prefix with "Rupees" and suffix with "Only".
 * - Max supported value: 99,99,99,999 (99 crore 99 lakh 99 thousand 999).
 *   Values above this return "Amount exceeds supported range".
 *
 * Implementation strategy:
 *   - Define arrays: ones[], teens[], tens[], thousands[]
 *     where thousands = ['', 'Thousand', 'Lakh', 'Crore']
 *   - Recursive helper convertHundreds(n) handles 0–999.
 *   - Main function chunks the integer using Indian grouping:
 *     [crores][lakhs][thousands][hundreds+tens+ones]
 *     and joins with the appropriate scale word.
 */
export function numberToWords(amount) { ... }
```

**Usage in PDF generation:**
```js
import { numberToWords } from '../../utils/numberToWords';
const amountInWords = numberToWords(grandTotal);
// → "Rupees Seven Thousand Eighty Only"
```

---

## 5. UI Implementation in `ProposalStage.jsx`

### 5.1 New UI Sections — Placement

All new UI elements are added **below** the existing `contractTermsDetails` textarea (the last existing input). Do not insert new elements above existing fields. The section order from top to bottom in the component is:

```
[EXISTING] moneyAskedFromClient input
[EXISTING] initialPaymentAmount input
[EXISTING] contractStartDate input
[EXISTING] contractEndDate input
[EXISTING] contractTermsDetails textarea
[EXISTING] Save Stage Data button
─────────────────────────────────────────
[NEW] ── Divider with label "Proposal Document Settings" ──
[NEW] Proposal Header Fields section
[NEW] Client Billing Details section
[NEW] Line Items table with Add/Remove row controls
[NEW] Tax Toggles & Totals summary (read-only)
[NEW] Special Terms & Conditions textarea
[NEW] Action Buttons row (Generate PDF | Send via Email)
[NEW] Error display
```

### 5.2 Proposal Header Fields UI

```jsx
{/* Section: Proposal Header */}
<div className="mt-6 pt-6 border-t border-gray-200">
  <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
    <FileText size={16} className="text-indigo-500" />
    Proposal Document Details
  </h4>

  {/* 2-column grid on desktop, stacked on mobile */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

    {/* Creation Date */}
    <div>
      <label className="text-xs font-medium text-gray-600">Creation Date</label>
      <input
        type="date"
        value={proposalCreationDate}
        onChange={e => setProposalCreationDate(e.target.value)}
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    {/* Expiry Date */}
    <div>
      <label className="text-xs font-medium text-gray-600">Expiry Date</label>
      <input
        type="date"
        value={proposalExpiryDate}
        onChange={e => setProposalExpiryDate(e.target.value)}
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    {/* Payment Terms */}
    <div>
      <label className="text-xs font-medium text-gray-600">Payment Terms</label>
      <input
        type="text"
        value={paymentTerms}
        onChange={e => setPaymentTerms(e.target.value)}
        placeholder="e.g., 50% advance, 50% on delivery"
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    {/* Delivery / Completion */}
    <div>
      <label className="text-xs font-medium text-gray-600">Delivery / Completion</label>
      <input
        type="text"
        value={deliveryCompletion}
        onChange={e => setDeliveryCompletion(e.target.value)}
        placeholder="e.g., 45 working days from kick-off"
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    {/* To */}
    <div>
      <label className="text-xs font-medium text-gray-600">To (Recipient)</label>
      <input
        type="text"
        value={proposalTo}
        onChange={e => setProposalTo(e.target.value)}
        placeholder="Company or person name"
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    {/* Dear */}
    <div>
      <label className="text-xs font-medium text-gray-600">Dear (Salutation)</label>
      <input
        type="text"
        value={proposalDear}
        onChange={e => setProposalDear(e.target.value)}
        placeholder="e.g., Mr. Rajan Sharma"
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  </div>
</div>
```

### 5.3 Client Billing Details UI

```jsx
{/* Section: Client Billing Details */}
<div className="mt-6">
  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
    Client Billing Details
  </h4>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* billingName, billingCompanyName, billingAddress (full width),
        billingCity, billingPincode, billingContactNumbers (full width),
        billingWebsite, billingGstNo
        — all follow the same input pattern as header fields above */}
  </div>
</div>
```

Map each billing state variable to a labeled input. `billingContactNumbers` uses a full-width field with a helper text: *"Separate multiple numbers with commas."*

### 5.4 Line Items Table UI

```jsx
{/* Section: Proposal Line Items */}
<div className="mt-6">
  <div className="flex items-center justify-between mb-3">
    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
      Proposal Items
    </h4>
    <button
      type="button"
      onClick={addLineItemRow}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                 text-indigo-600 border border-indigo-300 rounded-lg
                 hover:bg-indigo-50 transition-colors"
    >
      <Plus size={14} />
      Add Row
    </button>
  </div>

  {/* Scrollable table wrapper for narrow screens */}
  <div className="overflow-x-auto rounded-lg border border-gray-200">
    <table className="min-w-full text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-8">#</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Item & Description</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-32">Unit Price (₹)</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-20">Qty</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-32">Amount (₹)</th>
          <th className="w-10"></th>{/* Remove button column */}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {lineItems.map((item, idx) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
            <td className="px-3 py-2">
              <input
                type="text"
                value={item.description}
                onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                placeholder="Item or service description"
                className="w-full border-0 bg-transparent focus:ring-1 focus:ring-indigo-400
                           rounded px-2 py-1 text-sm"
              />
            </td>
            <td className="px-3 py-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={e => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                className="w-full border-0 bg-transparent focus:ring-1 focus:ring-indigo-400
                           rounded px-2 py-1 text-sm text-right"
              />
            </td>
            <td className="px-3 py-2">
              <input
                type="number"
                min="1"
                step="1"
                value={item.qty}
                onChange={e => updateLineItem(item.id, 'qty', parseInt(e.target.value, 10) || 1)}
                className="w-full border-0 bg-transparent focus:ring-1 focus:ring-indigo-400
                           rounded px-2 py-1 text-sm text-right"
              />
            </td>
            <td className="px-3 py-2 text-right text-sm font-medium text-gray-700">
              {formatINR(item.amount)}
            </td>
            <td className="px-3 py-2">
              <button
                type="button"
                onClick={() => removeLineItemRow(item.id)}
                disabled={lineItems.length <= 1}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500
                           disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Remove row"
              >
                <Trash2 size={14} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

### 5.5 Tax Toggles & Totals UI

```jsx
{/* Section: Tax & Totals */}
<div className="mt-4 flex justify-end">
  <div className="w-full max-w-xs space-y-2">

    {/* IGST Toggle */}
    <div className="flex items-center justify-between py-2 border-b border-gray-100">
      <span className="text-sm text-gray-600">Apply IGST (18%) instead of CGST+SGST</span>
      <button
        type="button"
        onClick={() => setUseIgst(v => !v)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
          ${useIgst ? 'bg-indigo-600' : 'bg-gray-300'}`}
        role="switch"
        aria-checked={useIgst}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow
                          transition-transform ${useIgst ? 'translate-x-4.5' : 'translate-x-0.5'}`}
        />
      </button>
    </div>

    {/* Totals rows — read-only computed values */}
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">Sub-Total</span>
      <span className="font-medium">{formatINR(subTotal)}</span>
    </div>

    {!useIgst && (
      <>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">CGST (9%)</span>
          <span>{formatINR(cgst)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">SGST (9%)</span>
          <span>{formatINR(sgst)}</span>
        </div>
      </>
    )}

    {useIgst && (
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">IGST (18%)</span>
        <span>{formatINR(igst)}</span>
      </div>
    )}

    <div className="flex justify-between text-base font-bold border-t border-gray-300 pt-2">
      <span>Total</span>
      <span>{formatINR(grandTotal)}</span>
    </div>
  </div>
</div>
```

### 5.6 Special Terms & Conditions UI

```jsx
<div className="mt-6">
  <label className="text-xs font-medium text-gray-600">
    Special Terms & Conditions
  </label>
  <textarea
    value={specialTerms}
    onChange={e => setSpecialTerms(e.target.value)}
    rows={4}
    placeholder="e.g., Freight terms, warranty clauses, SLA details, payment milestones..."
    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm
               focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
  />
</div>
```

### 5.7 Action Buttons Row

```jsx
{/* Section: Proposal Actions */}
<div className="mt-6 flex flex-wrap gap-3">

  {/* Generate PDF Button */}
  <button
    type="button"
    onClick={handleGeneratePDF}
    disabled={isGeneratingPdf || !companySettings}
    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
               text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60
               disabled:cursor-not-allowed transition-colors shadow-sm"
  >
    {isGeneratingPdf ? (
      <Loader size={16} className="animate-spin" />
    ) : (
      <Download size={16} />
    )}
    {isGeneratingPdf ? 'Generating...' : 'Generate Proposal PDF'}
  </button>

  {/* Send via Email Button */}
  <button
    type="button"
    onClick={() => setShowEmailModal(true)}
    disabled={isSendingEmail || !companySettings}
    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
               text-indigo-600 bg-white border border-indigo-300
               hover:bg-indigo-50 disabled:opacity-60 disabled:cursor-not-allowed
               transition-colors shadow-sm"
  >
    <Mail size={16} />
    Send via Email
  </button>
</div>

{/* Error display */}
{proposalError && (
  <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
    <AlertCircle size={13} />
    {proposalError}
  </p>
)}
```

**Lucide icons used in this section:** `FileText`, `Plus`, `Trash2`, `Download`, `Loader`, `Mail`, `AlertCircle`. All are available in `lucide-react`.

---

## 6. PDF Generation Engine

### 6.1 File Location

**File:** `src/utils/generateProposalPDF.js`

This is a standalone async function. It is imported and called from `ProposalStage.jsx`. It has zero React dependencies — pure data-in, PDF-out.

### 6.2 Imports

```js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToWords } from './numberToWords';
```

**Critical import note:** `autoTable` from `jspdf-autotable` must be imported as a default import (not a named import) in version 3.x. The plugin registers itself on the `jsPDF` prototype, so calling `import autoTable from 'jspdf-autotable'` is sufficient — after this import, `doc.autoTable()` becomes available on any `jsPDF` instance.

### 6.3 Function Signature

```js
/**
 * Generates a Proposal PDF and triggers a browser download.
 *
 * @param {object} params
 * @param {object} params.companySettings     — from getInvoiceSettings()
 * @param {object} params.proposalHeader      — { creationDate, expiryDate, paymentTerms,
 *                                               deliveryCompletion, to, dear }
 * @param {object} params.billingTo           — { name, companyName, address, city,
 *                                               pincode, contactNumbers, website, gstNo }
 * @param {LineItem[]} params.lineItems       — [{ description, unitPrice, qty, amount }]
 * @param {object} params.totals              — { subTotal, cgst, sgst, igst, grandTotal,
 *                                               useIgst }
 * @param {string} params.specialTerms        — free-text terms paragraph
 * @param {string} params.opportunityTitle    — used in the PDF filename
 * @returns {Promise<void>}                   — resolves after download is triggered
 *                                             rejects with Error on failure
 */
export async function generateProposalPDF({ companySettings, proposalHeader, billingTo,
                                            lineItems, totals, specialTerms,
                                            opportunityTitle }) { ... }
```

### 6.4 PDF Layout Specification

**Page setup:**
```js
const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
const PAGE_W = 210;  // A4 width in mm
const PAGE_H = 297;  // A4 height in mm
const MARGIN = 14;   // Left and right margin in mm
const CONTENT_W = PAGE_W - (MARGIN * 2);  // 182mm usable width
```

**Color palette** (define as constants at top of function):
```js
const COLOR_DARK       = [26,  26,  46];   // #1a1a2e — dark navy, matches Wavelet brand
const COLOR_MID_GREY   = [100, 100, 100];  // for secondary text
const COLOR_LIGHT_GREY = [240, 240, 240];  // table header background
const COLOR_WHITE      = [255, 255, 255];
const COLOR_ACCENT     = [99,  102, 241];  // indigo-500 — used for section dividers
```

---

#### Block 1 — Header Bar (y: 0 → ~30mm)

```
Layout: Full-width colored bar (COLOR_DARK fill), white text

Components:
  Rectangle: x=0, y=0, w=PAGE_W, h=28, fill=COLOR_DARK

  "PROPOSAL" text:
    font: 'helvetica', style: 'bold', size: 22, color: WHITE
    position: x=MARGIN, y=17 (baseline)

  Company Logo (if companySettings.company.logoUrl exists):
    Load as base64 using fetch().then(r=>r.blob()).then(blob => new Promise resolve FileReader.readAsDataURL)
    Image placement: x=PAGE_W-MARGIN-35, y=4, w=35, h=20
    format: 'PNG' or 'JPEG' (detect from URL extension)
    FALLBACK (no logo): Render company name in white text at same position,
      font: 'helvetica', style: 'bold', size: 11

  "Skeleton Document" subtext (only if logoUrl is null):
    font: 'helvetica', style: 'normal', size: 8, color: [200,200,200]
    y=22

Current Y cursor after block: 34mm
```

**Logo loading implementation:**
```js
// Inside generateProposalPDF, before doc creation:
let logoDataUrl = null;
if (companySettings.company.logoUrl) {
  try {
    const response = await fetch(companySettings.company.logoUrl);
    const blob     = await response.blob();
    logoDataUrl    = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    // Logo fetch failed — proceed without logo, render company name instead
    logoDataUrl = null;
  }
}
```

---

#### Block 2 — Proposal Meta Row (y: ~34 → ~52mm)

```
Creation Date line (left-aligned):
  "Creation Date: [formatted date]   Expiry Date: [formatted date]   Payment Terms: [string]"
  font: size 9, color: COLOR_MID_GREY
  y: 34, x: MARGIN

"Delivery/Completion: [string]"
  font: size 9, color: COLOR_MID_GREY
  y: 40, x: MARGIN

"To: [proposalHeader.to]"
  font: size 10, style: 'bold', color: COLOR_DARK
  y: 46, x: MARGIN

"Dear [proposalHeader.dear],"
  font: size 10, style: 'normal'
  y: 52, x: MARGIN

Boilerplate intro paragraph (word-wrap to CONTENT_W):
  text: "As per your requirement, We are pleased to submit our formal proposal
         and look forward to strengthen our relationship by providing the latest
         and most cost-effective products and solutions."
  font: size 9, style: 'italic', color: COLOR_MID_GREY
  doc.text(text, MARGIN, 60, { maxWidth: CONTENT_W })
  — jsPDF handles word-wrap via maxWidth option

Horizontal rule after intro:
  doc.setDrawColor(...COLOR_ACCENT)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, 70, PAGE_W - MARGIN, 70)

Current Y cursor after block: ~72mm
```

**Date formatting helper** (define inside `generateProposalPDF.js`):
```js
function formatPdfDate(dateStr) {
  // dateStr: 'YYYY-MM-DD' (HTML input native format)
  if (!dateStr) return 'N/A';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
```

---

#### Block 3 — BILLING TO Table (y: ~72 → ~90mm)

```
Section label:
  "BILLING TO"
  font: size 10, style: 'bold', color: COLOR_DARK
  y: 72

Render using doc.autoTable():

  startY: 76
  head: [['Name', 'Company', 'Address', 'Pincode', 'Contact Info', 'GST No.']]
  body: [[
    billingTo.name,
    billingTo.companyName,
    `${billingTo.address}\n${billingTo.city}`,  // \n = newline in autoTable cells
    `${billingTo.city}-\n${billingTo.pincode}`,
    billingTo.contactNumbers.split(',').join('\n'),  // one number per line
    billingTo.gstNo
  ]]

  styles:
    font: 'helvetica', fontSize: 8, cellPadding: 3

  headStyles:
    fillColor: COLOR_DARK, textColor: COLOR_WHITE, fontSize: 8, fontStyle: 'bold'

  columnStyles:
    0: { cellWidth: 28 }   // Name
    1: { cellWidth: 32 }   // Company
    2: { cellWidth: 40 }   // Address
    3: { cellWidth: 20 }   // Pincode
    4: { cellWidth: 36 }   // Contact Info
    5: { cellWidth: 'auto' } // GST No — fills remaining width

  Note: billingTo.website is rendered below the table as a caption:
    "Web: [billingTo.website]"
    font size 8, color: COLOR_MID_GREY
    y: doc.lastAutoTable.finalY + 3

Current Y cursor: doc.lastAutoTable.finalY + 8
```

---

#### Block 4 — PROPOSAL DETAILS Table (y: dynamic)

```
Section label: "PROPOSAL DETAILS"
  font: size 10, style: 'bold'
  y: currentY

doc.autoTable():
  startY: currentY + 4

  head: [['S.No', 'Item & Description', 'Unit Price', 'Qty', 'Amount']]

  body: lineItems.map((item, idx) => [
    idx + 1,
    item.description,
    `Rs ${item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    item.qty,
    `Rs ${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
  ])

  headStyles:
    fillColor: COLOR_DARK, textColor: COLOR_WHITE, fontSize: 9, fontStyle: 'bold'

  bodyStyles:
    fontSize: 9, textColor: COLOR_DARK

  alternateRowStyles:
    fillColor: [248, 248, 255]  // very light lavender for zebra striping

  columnStyles:
    0: { cellWidth: 12, halign: 'center' }   // S.No
    1: { cellWidth: 'auto' }                  // Description — flexible
    2: { cellWidth: 32, halign: 'right' }     // Unit Price
    3: { cellWidth: 14, halign: 'center' }    // Qty
    4: { cellWidth: 32, halign: 'right' }     // Amount

  margin: { left: MARGIN, right: MARGIN }

Current Y cursor: doc.lastAutoTable.finalY + 2
```

---

#### Block 5 — Totals Block (y: dynamic, right-aligned)

```
Rendered as a mini autoTable positioned on the RIGHT side of the page:

doc.autoTable():
  startY: currentY
  margin: { left: PAGE_W - MARGIN - 82 }  // right-aligns to right margin

  body: build dynamically:
    always include: ['Sub-Total', `Rs ${fmtNum(totals.subTotal)}`]
    if !useIgst:
      ['CGST (9%)',  `Rs ${fmtNum(totals.cgst)}`]
      ['SGST (9%)',  `Rs ${fmtNum(totals.sgst)}`]
    if useIgst:
      ['IGST (18%)', `Rs ${fmtNum(totals.igst)}`]
    always include (LAST row, bold):
      ['Total',      `Rs ${fmtNum(totals.grandTotal)}`]

  columnStyles:
    0: { cellWidth: 50, fontStyle: 'bold', fontSize: 9 }
    1: { cellWidth: 32, halign: 'right',   fontSize: 9 }

  styles:
    lineWidth: 0.1, lineColor: [220, 220, 220]

  willDrawCell callback:
    if cell.row.index === body.length - 1 (last row — Total):
      set cell.styles.fontStyle = 'bold'
      set cell.styles.fontSize  = 10
      set cell.styles.fillColor = COLOR_LIGHT_GREY

Current Y cursor: doc.lastAutoTable.finalY + 4

"Amount in Words: [numberToWords(totals.grandTotal)]"
  font: size 9, style: 'italic', color: COLOR_MID_GREY
  x: MARGIN, y: currentY
  doc.text(`Amount in Words: ${numberToWords(totals.grandTotal)}`, MARGIN, currentY,
           { maxWidth: CONTENT_W })

Current Y cursor: += 10
```

**Number formatting helper** (define inline):
```js
const fmtNum = (n) =>
  Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
```

---

#### Block 6 — Special Terms & Conditions (y: dynamic)

```
Section label: "SPECIAL TERMS & CONDITIONS"
  font: size 10, style: 'bold'

Paragraph:
  doc.text(specialTerms || 'Not specified.', MARGIN, currentY + 4, { maxWidth: CONTENT_W })
  Estimate line height: 5mm per line, font size 9

Horizontal rule after section.

Current Y cursor: += estimatedTextHeight + 8

Page overflow guard: if currentY > PAGE_H - 60:
  doc.addPage()
  currentY = MARGIN  (reset to top of new page)
```

---

#### Block 7 — Footer: Payment Info + Company Details (y: dynamic, two-column)

```
Layout: Two columns, side by side
  Left column (x: MARGIN, width: ~85mm): Payment Information
  Right column (x: MARGIN + 95, width: ~85mm): Company Details

LEFT — Payment Information:
  "PAYMENT INFORMATION" heading (bold, size 9)
  Lines (size 9, lineHeight 5mm each):
    "Bank: [payment.bankName]"
    "Account Name: [payment.accountName]"
    "Account No.: [payment.accountNumber]"
    "IFSC Code: [payment.ifscCode]"
    "UPI No.: [payment.upiNumber]"

RIGHT — Company Details:
  "COMPANY DETAILS" heading (bold, size 9)
  Lines:
    "[company.name]" (bold)
    "[company.addressLine1], [company.addressLine2]"
    "Pincode: [company.pincode]"
    "Phone: [company.phoneNumbers.join(', ')]"
    "Web: [company.website]"
    "GST No: [company.gstNumber]"

Horizontal rule below both columns.

Footer caption (centered, bottom of page):
  "This is a system generated proposal and does not require a physical signature."
  font: size 8, style: 'italic', color: [160, 160, 160]
  y: PAGE_H - 8
  halign: 'center', x: PAGE_W / 2
```

---

#### Block 8 — Download Trigger

```js
// After all blocks are rendered:
const safeTitle = (opportunityTitle ?? 'Proposal')
  .replace(/[^a-zA-Z0-9_\- ]/g, '')  // sanitize filename
  .replace(/\s+/g, '_');
const timestamp = new Date().toISOString().split('T')[0];

doc.save(`Wavelet_Proposal_${safeTitle}_${timestamp}.pdf`);
```

### 6.5 `handleGeneratePDF` Handler (in `ProposalStage.jsx`)

```js
const handleGeneratePDF = async () => {
  setProposalError(null);

  // Guard: company settings must be loaded
  if (!companySettings) {
    setProposalError('Company settings not loaded. Please check Invoice Settings and retry.');
    return;
  }

  // Guard: at least one line item must have a description
  if (lineItems.every(item => !item.description.trim())) {
    setProposalError('Please add at least one line item with a description.');
    return;
  }

  setIsGeneratingPdf(true);
  try {
    await generateProposalPDF({
      companySettings,
      proposalHeader: {
        creationDate:     proposalCreationDate,
        expiryDate:       proposalExpiryDate,
        paymentTerms,
        deliveryCompletion,
        to:   proposalTo,
        dear: proposalDear,
      },
      billingTo: {
        name:           billingName,
        companyName:    billingCompanyName,
        address:        billingAddress,
        city:           billingCity,
        pincode:        billingPincode,
        contactNumbers: billingContactNumbers,
        website:        billingWebsite,
        gstNo:          billingGstNo,
      },
      lineItems,
      totals: { subTotal, cgst, sgst, igst, grandTotal, useIgst },
      specialTerms,
      opportunityTitle: opportunity.title ?? 'Proposal',
    });
  } catch (err) {
    console.error('[ProposalStage] PDF generation failed:', err);
    setProposalError(`PDF generation failed: ${err.message}`);
  } finally {
    setIsGeneratingPdf(false);
  }
};
```

---

## 7. Email Dispatch Logic

### 7.1 Strategy

The `jsPDF` library can produce the PDF as a Blob or base64 string in the browser. However, **sending email directly from the browser is not possible without a backend or third-party relay**. The recommended approach for this CRM architecture (serverless Firebase) is to offer the admin a **mailto: deep link** that opens their default email client with the subject and body pre-filled. The admin attaches the downloaded PDF manually.

For a fully automated email, a Firebase Cloud Function + SendGrid/Nodemailer integration is required (out of scope for this feature sprint — see §7.3).

### 7.2 `<SendEmailModal />` Component

**File:** `src/pages/Opportunities/stages/SendEmailModal.jsx`

**Props:**
```
isOpen         : boolean
onClose        : () => void
recipientEmail : string        — pre-filled from opportunity.clientEmail
opportunityTitle : string
grandTotal     : number
onSendAndDownload : () => Promise<void>  — generates PDF then triggers email
```

**Modal content:**
```
Title: "Send Proposal via Email"

Field 1: Recipient Email (pre-filled, editable)
  <input type="email" value={recipientEmail} onChange=... />

Field 2: Subject (pre-filled, editable)
  Default: "Proposal from Wavelet — [opportunityTitle]"

Field 3: Body preview (read-only text area)
  Content:
    "Dear [proposalDear],

     Please find attached our proposal for [opportunityTitle].

     Total Proposed Value: ₹[grandTotal formatted]

     Please review and let us know if you have any questions.

     Warm regards,
     [companySettings.preparedBy.signatureText]"

Action Buttons:
  [Cancel]
  [Download PDF & Open Email Client]
    — onClick:
        1. Call onSendAndDownload() — generates and downloads PDF
        2. Build mailto: URL:
           const subject = encodeURIComponent(subjectField)
           const body    = encodeURIComponent(bodyField)
           const email   = encodeURIComponent(recipientField)
           window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
        3. A toast/info message appears:
           "PDF downloaded. Attach it to the email that just opened in your mail client."
```

### 7.3 Future Enhancement Note (comment in code)

```js
// TODO (Phase 2 — Email Automation):
// Replace the mailto: approach with a Firebase Cloud Function
// that accepts { recipientEmail, pdfBase64, subject, body }
// and uses SendGrid or Nodemailer to dispatch programmatically.
// The PDF can be generated as base64 using: doc.output('datauristring')
// and passed to the Cloud Function via httpsCallable().
```

---

## 8. Firestore Schema Additions

All new fields are added to the existing `proposal` map inside the opportunity document. This is non-destructive — existing `proposal.*` fields are unchanged.

```
opportunities/{opportunityId}.proposal:
  │
  ├── [EXISTING FIELDS — unchanged]
  │   moneyAskedFromClient, initialPaymentAmount,
  │   contractStartDate, contractEndDate, contractTermsDetails
  │
  └── [NEW FIELDS — added by ProposalStage save handler]
      creationDate:         string      // 'YYYY-MM-DD' — HTML date string
      expiryDate:           string      // 'YYYY-MM-DD'
      paymentTerms:         string
      deliveryCompletion:   string
      proposalTo:           string
      proposalDear:         string
      specialTerms:         string
      useIgst:              boolean     // false = CGST+SGST; true = IGST
      lineItems:            array of {
        id:          string
        description: string
        unitPrice:   number
        qty:         number
        amount:      number
      }
      billingName:          string
      billingCompanyName:   string
      billingAddress:       string
      billingCity:          string
      billingPincode:       string
      billingContactNumbers: string     // comma-separated raw string
      billingWebsite:       string
      billingGstNo:         string
```

**Save handler extension** — find the existing `handleSave()` or `updateDoc()` call inside `ProposalStage.jsx` that saves the proposal stage. Extend its Firestore payload object with the new fields using dot notation:

```js
// Add these to the existing updateDoc payload object:
'proposal.creationDate':          proposalCreationDate,
'proposal.expiryDate':            proposalExpiryDate,
'proposal.paymentTerms':          paymentTerms,
'proposal.deliveryCompletion':    deliveryCompletion,
'proposal.proposalTo':            proposalTo,
'proposal.proposalDear':          proposalDear,
'proposal.specialTerms':          specialTerms,
'proposal.useIgst':               useIgst,
'proposal.lineItems':             lineItems,
'proposal.billingName':           billingName,
'proposal.billingCompanyName':    billingCompanyName,
'proposal.billingAddress':        billingAddress,
'proposal.billingCity':           billingCity,
'proposal.billingPincode':        billingPincode,
'proposal.billingContactNumbers': billingContactNumbers,
'proposal.billingWebsite':        billingWebsite,
'proposal.billingGstNo':          billingGstNo,
```

---

## 9. File & Module Structure

### 9.1 New Files Created

```
src/
├── utils/
│   ├── numberToWords.js               ← Pure function: number → Indian English words
│   └── generateProposalPDF.js         ← PDF generation engine (jsPDF + autoTable)
│
└── pages/
    └── Opportunities/
        └── stages/
            └── SendEmailModal.jsx     ← Email dispatch confirmation modal
```

### 9.2 Files Modified (surgical additions only)

| File | What is added |
|------|--------------|
| `src/pages/Opportunities/stages/ProposalStage.jsx` | All new state (§2.1), settings fetch (§3.3), new UI sections (§5.2–5.7), `handleGeneratePDF` handler (§6.5) |

### 9.3 Dependencies Used

| Import | Source | Used In |
|--------|--------|---------|
| `jsPDF` | `jspdf` | `generateProposalPDF.js` |
| `autoTable` | `jspdf-autotable` | `generateProposalPDF.js` |
| `numberToWords` | `src/utils/numberToWords.js` | `generateProposalPDF.js` |
| `generateProposalPDF` | `src/utils/generateProposalPDF.js` | `ProposalStage.jsx` |
| `getInvoiceSettings` | existing `invoiceSettingsService` | `ProposalStage.jsx` |
| `SendEmailModal` | `src/pages/Opportunities/stages/SendEmailModal.jsx` | `ProposalStage.jsx` |
| `formatINR` | existing utility | `ProposalStage.jsx` (line items table) |
| `FileText`, `Plus`, `Trash2`, `Download`, `Loader`, `Mail`, `AlertCircle` | `lucide-react` | `ProposalStage.jsx` |

### 9.4 No New Firebase Security Rules Required

The proposal data is stored inside the existing `opportunities/{opportunityId}` document under the `proposal` map. The existing Firestore security rules for the opportunities collection already cover admin reads and writes to this document. No new rule blocks are needed.

The `getInvoiceSettings()` call reads from `app_config/company_defaults`, which is already secured by the existing `app_config` rule permitting authenticated reads.
