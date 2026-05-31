# CRM Admin Features Blueprint
### Wavelet CRM · Analytics Dashboard & Import/Export Hub
#### `CRM_Admin_Features_Blueprint.md`

> **Agent Directive:** This document is your complete implementation guide. Read every section before writing any code. Execute phases sequentially — do not begin a new phase until the current one is verified. All changes are additive. No existing component logic, Firestore collection, or route is modified unless explicitly stated. When a decision point is ambiguous, apply the most conservative interpretation and flag it in a code comment.

---

## Table of Contents
1. [Dependency & Route Setup](#phase-1-dependency--route-setup)
2. [Analytics Dashboard — Data Layer](#phase-2-analytics-dashboard--data-layer)
3. [Analytics Dashboard — UI & Charts](#phase-3-analytics-dashboard--ui--charts)
4. [Import/Export Hub — Skeleton & Export](#phase-4-importexport-hub--skeleton--export)
5. [Import/Export Hub — Import & Staging UI](#phase-5-importexport-hub--import--staging-ui)
6. [Firebase Security Rules Updates](#phase-6-firebase-security-rules-updates)
7. [File Structure Reference](#phase-7-file-structure-reference)

---

## Phase 1: Dependency & Route Setup

### 1.1 Install New Dependencies

Run in the project root. Do not modify `package.json` manually:

```bash
npm install recharts xlsx
```

**Library roles:**
- `recharts` — React-native charting library built on D3. Uses SVG. Fully compatible with React 19 and Tailwind. No additional CSS imports required.
- `xlsx` (SheetJS community edition) — Client-side Excel parsing and generation. Handles `.xlsx` read/write entirely in the browser. No server required.

**Vite compatibility note for `xlsx`:** SheetJS uses Node.js polyfills internally. If Vite throws a `Buffer is not defined` error at runtime, add this to `vite.config.js`:

```js
// vite.config.js — add only if the Buffer error occurs:
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
});
```

---

### 1.2 New Route Definitions

Add two new protected routes to the existing React Router v7 router configuration. Locate the file that defines the main route tree (likely `src/router.jsx`, `src/App.jsx`, or `src/main.jsx`).

**New routes to add:**

| Path | Component | Guard |
|------|-----------|-------|
| `/analytics` | `<AnalyticsDashboardPage />` | Admin + Super Admin only |
| `/import-export` | `<ImportExportPage />` | Admin + Super Admin only |

**Route configuration pattern** (adapt to the existing router setup — do not change routing strategy):

```
/analytics       → src/pages/Analytics/AnalyticsDashboardPage.jsx
/import-export   → src/pages/ImportExport/ImportExportPage.jsx
```

Both routes must be wrapped in the existing `<ProtectedRoute>` or role-guard component with the same pattern used by the existing Leads and Salary admin-only routes. Workers navigating to either path must be redirected to `/dashboard`.

---

### 1.3 Navigation Links

Add two new navigation entries to the existing sidebar/navbar component (whatever component renders the main nav). Apply the same `role in ['admin', 'super_admin']` visibility check used by other admin nav items.

```
Icon: BarChart2       → Label: "Analytics"       → to="/analytics"
Icon: ArrowLeftRight  → Label: "Import / Export"  → to="/import-export"
```

Both icons are available in `lucide-react`.

---

### 1.4 Page Scaffold Files

Create the two top-level page files as minimal scaffolds first, then flesh them out in later phases. This ensures routes resolve before any data logic is written.

**`src/pages/Analytics/AnalyticsDashboardPage.jsx`** — initial scaffold:
```
Renders: <div>Analytics Dashboard — Loading...</div>
Exports: default function AnalyticsDashboardPage
```

**`src/pages/ImportExport/ImportExportPage.jsx`** — initial scaffold:
```
Renders: <div>Import / Export Hub — Loading...</div>
Exports: default function ImportExportPage
```

✅ **Phase 1 complete checkpoint:** Both routes load without errors. Nav links appear for admin users. Workers are redirected.

---

## Phase 2: Analytics Dashboard — Data Layer

### 2.1 Overview of Required Data Sources

The Analytics Dashboard reads from three Firestore collections. All listeners use `onSnapshot` for real-time updates. No one-shot `getDocs` calls.

| Collection | Fields Consumed |
|-----------|----------------|
| `projects` | `status`, `estimatedBilling`, `estimatedBudget`, `amountPaid`, `title`, `createdAt` |
| `users` | `role`, `salary.type`, `salary.monthly.fixedMonthlySalary`, `salary.project.agreedBasePay`, `salary.hourly.ratePerHour` |
| `users/{uid}/shifts` (subcollection) | `isValidated`, `durationMinutes`, `projectId` |

**Important constraint:** Do not open one `onSnapshot` per user to fetch shifts. Instead, use a **Collection Group Query** on `shifts` to fetch all validated shifts across all users in a single listener. This requires a Firestore index (see Phase 6).

---

### 2.2 Custom Hook — `useAnalyticsData.js`

**File:** `src/hooks/useAnalyticsData.js`

This hook owns all three `onSnapshot` listeners and exposes processed data ready for the chart components. It must clean up all listeners on unmount.

**State variables to declare inside the hook:**

```
projects       : array   — raw Firestore project documents, default []
workers        : array   — raw user documents where role === 'worker', default []
allShifts      : array   — all validated shifts from collectionGroup query, default []
loading        : boolean — true until all three listeners have fired at least once
error          : string | null
```

**Listener 1 — Projects:**
```
Collection: 'projects'
Query constraints:
  where('isArchived', '==', false)   // or isDeleted — match existing field name
  orderBy('createdAt', 'desc')
On snapshot: map docs → { id: d.id, ...d.data() } → setProjects()
```

**Listener 2 — Workers:**
```
Collection: 'users'
Query constraints:
  where('role', '==', 'worker')
On snapshot: map docs → { id: d.id, ...d.data() } → setWorkers()
```

**Listener 3 — All Validated Shifts (Collection Group):**
```
Collection group: 'shifts'
Query constraints:
  where('isValidated', '==', true)
  where('status', '==', 'completed')
On snapshot: map docs → { id: d.id, ...d.data() } → setAllShifts()
```

**Loading gate:** Use a `useRef` counter initialized to 0. Increment on each listener's first snapshot. When counter reaches 3, set `loading = false`. This prevents a flash of empty charts before all data arrives.

---

### 2.3 Computed Analytics Values — `analyticsEngine.js`

**File:** `src/utils/analyticsEngine.js`

All math is in pure functions. No Firestore calls. Takes the raw arrays from `useAnalyticsData` and returns structured objects consumed directly by chart components.

**Define the following exported functions:**

---

**`computeProjectKPIs(projects)`**

Input: raw projects array.
Returns object:
```
{
  totalProjects      : number   — projects.length
  ongoingCount       : number   — filter status === 'ongoing'
  completedCount     : number   — filter status === 'completed'
  cancelledCount     : number   — filter status === 'cancelled'
  totalRevenue       : number   — sum of estimatedBilling across ALL projects
  totalCosts         : number   — sum of estimatedBudget across ALL projects
  totalAmountPaid    : number   — sum of amountPaid (actual payments received)
  totalProfit        : number   — totalRevenue - totalCosts
  profitMarginPct    : number   — (totalProfit / totalRevenue) * 100, clamped to 2 decimal places
                                  Returns 0 if totalRevenue is 0 (divide-by-zero guard)
}
```

---

**`computeRevenueVsCostChartData(projects)`**

Input: raw projects array.
Returns array of objects for a Recharts `BarChart`:
```
[
  { name: '[project.title truncated to 20 chars]', revenue: number, cost: number },
  ...
]
```
Include only projects where `status !== 'cancelled'`. Sort by `revenue` descending. Cap at the **top 10 projects** to prevent chart overflow on large datasets.

---

**`computeStatusPieData(projects)`**

Input: raw projects array.
Returns array for a Recharts `PieChart`:
```
[
  { name: 'Ongoing',   value: ongoingCount,   fill: '#3b82f6' },  // blue-500
  { name: 'Completed', value: completedCount, fill: '#22c55e' },  // green-500
  { name: 'Cancelled', value: cancelledCount, fill: '#ef4444' },  // red-500
]
```
Filter out entries where `value === 0` so empty slices don't pollute the legend.

---

**`computeSalaryDistribution(workers)`**

Input: raw workers array with `salary` map field.
Returns array for a Recharts `PieChart`:
```
[
  { name: 'Project-Based', value: count, fill: '#8b5cf6' },  // violet-500
  { name: 'Monthly',       value: count, fill: '#f59e0b' },  // amber-500
  { name: 'Hourly',        value: count, fill: '#06b6d4' },  // cyan-500
  { name: 'Unconfigured',  value: count, fill: '#9ca3af' },  // gray-400
]
```
Classify each worker by `worker.salary?.type`. If `salary` is absent or `isConfigured === false`, count as 'Unconfigured'.

---

**`computeWorkerShiftData(workers, allShifts)`**

Input: workers array + all validated shifts.
Returns array for a Recharts `BarChart` (top workers by hours):
```
[
  { name: '[worker displayName, max 15 chars]', hours: number },
  ...
]
```
Logic:
- Group `allShifts` by `userId` (the shift document should contain `userId`).
- For each worker, sum `durationMinutes` of their validated shifts → divide by 60 → round to 1 decimal → `hours`.
- Sort descending by `hours`. Cap at top 10.

---

**`computeMonthlyRevenueTrend(projects)`**

Input: raw projects array.
Returns array for a Recharts `LineChart`:
```
[
  { month: 'Jan 2025', revenue: number, cost: number },
  { month: 'Feb 2025', revenue: number, cost: number },
  ...
]
```
Logic:
- For each project, extract the month-year from `createdAt` (Firestore Timestamp → `.toDate()` → format with `date-fns` `format(date, 'MMM yyyy')`).
- Group projects by this month-year key.
- For each month, sum `estimatedBilling` → `revenue`, sum `estimatedBudget` → `cost`.
- Sort chronologically (earliest month first).
- Include only the last 12 months.

---

### 2.4 Required Firestore Index

The Collection Group query on `shifts` requires a composite index. Add to `firestore.indexes.json`:

```json
{
  "collectionGroup": "shifts",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "isValidated", "order": "ASCENDING" },
    { "fieldPath": "status",      "order": "ASCENDING" }
  ]
}
```

Deploy with: `firebase deploy --only firestore:indexes`

---

## Phase 3: Analytics Dashboard — UI & Charts

### 3.1 Page Layout — `AnalyticsDashboardPage.jsx`

Replace the Phase 1 scaffold with the full component.

**State/data:**
```
const { projects, workers, allShifts, loading, error } = useAnalyticsData();
```

**Computed values** (all in `useMemo` to prevent recalculation on every render):
```
const kpis           = useMemo(() => computeProjectKPIs(projects), [projects]);
const revenueVsCost  = useMemo(() => computeRevenueVsCostChartData(projects), [projects]);
const statusPie      = useMemo(() => computeStatusPieData(projects), [projects]);
const salaryDist     = useMemo(() => computeSalaryDistribution(workers), [workers]);
const workerHours    = useMemo(() => computeWorkerShiftData(workers, allShifts), [workers, allShifts]);
const revenueTrend   = useMemo(() => computeMonthlyRevenueTrend(projects), [projects]);
```

**Loading state:** While `loading === true`, render a full-page skeleton (see §3.3). Do not render any charts with empty data — Recharts will throw errors on empty `data` arrays without guard conditions.

**Error state:** If `error` is non-null, render a centered error card with a "Retry" button that re-mounts the component.

---

### 3.2 Layout Structure

```
<AnalyticsDashboardPage>
  │
  ├── Page Header
  │     "Analytics Dashboard"  [last updated: live timestamp]
  │
  ├── <KPICardsRow />                         ← 6 cards in a responsive grid
  │
  ├── Row 1 (2-column grid on desktop, stacked on mobile):
  │     <RevenueVsCostBarChart />              ← recharts BarChart
  │     <ProjectStatusPieChart />             ← recharts PieChart
  │
  ├── Row 2 (2-column grid):
  │     <MonthlyRevenueTrendChart />          ← recharts LineChart (full width)
  │
  └── Row 3 (2-column grid):
        <WorkerHoursBarChart />               ← recharts BarChart
        <SalaryTypeDistributionPieChart />    ← recharts PieChart
```

---

### 3.3 `<KPICardsRow />` — KPI Cards

**File:** `src/pages/Analytics/components/KPICardsRow.jsx`

Renders 6 `<KPICard />` components in a `grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4` container.

**Props received:** the full `kpis` object from `computeProjectKPIs`.

**Six cards — label, value, icon (Lucide), color accent:**

| # | Label | Value | Icon | Accent Color |
|---|-------|-------|------|--------------|
| 1 | Total Revenue | `formatINR(kpis.totalRevenue)` | `TrendingUp` | green |
| 2 | Total Costs | `formatINR(kpis.totalCosts)` | `TrendingDown` | red |
| 3 | Total Profit | `formatINR(kpis.totalProfit)` | `DollarSign` | blue |
| 4 | Ongoing Projects | `kpis.ongoingCount` | `Loader` | amber |
| 5 | Completed Projects | `kpis.completedCount` | `CheckCircle` | green |
| 6 | Cancelled Projects | `kpis.cancelledCount` | `XCircle` | red |

**`<KPICard />` structure:**
```
src/pages/Analytics/components/KPICard.jsx

Props: { label, value, Icon, accentColor }

Layout:
  <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <Icon size={16} className={`text-${accentColor}-500`} />
    </div>
    <span className="text-2xl font-bold text-gray-900">{value}</span>
  </div>
```

**Profit card special case:** If `kpis.totalProfit < 0`, apply red text to the value and swap the icon to `AlertTriangle`. If `>= 0`, apply green text.

---

### 3.4 Chart Component Specifications

All chart components live in `src/pages/Analytics/components/`. Each is a self-contained component receiving only the pre-computed data array as a prop. They do not call hooks or touch Firestore.

Each chart component follows this wrapper pattern:
```jsx
<div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
  <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
  <ResponsiveContainer width="100%" height={300}>
    { /* recharts component */ }
  </ResponsiveContainer>
</div>
```

---

**`<RevenueVsCostBarChart />`**

```
File:  src/pages/Analytics/components/RevenueVsCostBarChart.jsx
Props: { data }  — output of computeRevenueVsCostChartData

Recharts component: <BarChart data={data}>
  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
  <YAxis tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
  <Tooltip formatter={(value) => formatINR(value)} />
  <Legend />
  <Bar dataKey="revenue" name="Revenue"  fill="#3b82f6" radius={[4,4,0,0]} />
  <Bar dataKey="cost"    name="Cost"     fill="#f97316" radius={[4,4,0,0]} />
</BarChart>

Guard: if data.length === 0, render <EmptyChartState message="No project data available" />
```

---

**`<ProjectStatusPieChart />`**

```
File:  src/pages/Analytics/components/ProjectStatusPieChart.jsx
Props: { data }  — output of computeStatusPieData

Recharts component: <PieChart>
  <Pie
    data={data}
    cx="50%"
    cy="50%"
    innerRadius={60}    ← Donut style
    outerRadius={100}
    paddingAngle={4}
    dataKey="value"
    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
    labelLine={false}
  >
    {data.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
  </Pie>
  <Tooltip formatter={(value) => `${value} projects`} />
  <Legend />
</PieChart>

Guard: if data.length === 0 OR all values are 0, render <EmptyChartState />
```

---

**`<MonthlyRevenueTrendChart />`**

```
File:  src/pages/Analytics/components/MonthlyRevenueTrendChart.jsx
Props: { data }  — output of computeMonthlyRevenueTrend

Recharts component: <LineChart data={data}>
  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
  <YAxis tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
  <Tooltip formatter={(value) => formatINR(value)} />
  <Legend />
  <Line
    type="monotone" dataKey="revenue" name="Revenue"
    stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}
  />
  <Line
    type="monotone" dataKey="cost" name="Cost"
    stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5"
  />
</LineChart>

Guard: if data.length < 2, render <EmptyChartState message="Not enough data for trend analysis" />
```

---

**`<WorkerHoursBarChart />`**

```
File:  src/pages/Analytics/components/WorkerHoursBarChart.jsx
Props: { data }  — output of computeWorkerShiftData

Recharts component: <BarChart data={data} layout="vertical">
  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
  <XAxis type="number" unit=" hrs" tick={{ fontSize: 11 }} />
  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
  <Tooltip formatter={(v) => `${v} hrs`} />
  <Bar dataKey="hours" fill="#8b5cf6" radius={[0,4,4,0]} />
</BarChart>

Note: layout="vertical" is critical — makes bars horizontal (workers on Y axis, hours on X).
Guard: if data.length === 0, render <EmptyChartState message="No validated shift data" />
```

---

**`<SalaryTypeDistributionPieChart />`**

```
File:  src/pages/Analytics/components/SalaryTypeDistributionPieChart.jsx
Props: { data }  — output of computeSalaryDistribution

Same Recharts structure as <ProjectStatusPieChart />.
Tooltip formatter: (value) => `${value} workers`
Guard: same empty check.
```

---

### 3.5 `<EmptyChartState />` — Shared Null State

**File:** `src/pages/Analytics/components/EmptyChartState.jsx`

```
Props: { message = "No data available" }

Renders: centered flex column, InboxIcon (Lucide), gray text
Height: 300px (matches ResponsiveContainer height so layout doesn't collapse)
```

---

### 3.6 `<AnalyticsSkeleton />` — Loading State

**File:** `src/pages/Analytics/components/AnalyticsSkeleton.jsx`

```
Renders:
  - 6 skeleton KPI card placeholders (animate-pulse, gray-200 bg, correct height)
  - 4 skeleton chart placeholders (animate-pulse, correct height 300px each)

Use Tailwind's animate-pulse on rounded-xl bg-gray-200 divs.
No recharts involved — pure CSS skeleton.
```

✅ **Phase 3 complete checkpoint:** Analytics dashboard renders all 6 KPI cards and 5 charts. Empty states display correctly when collections are empty. Loading skeleton shows during initial data fetch.

---

## Phase 4: Import/Export Hub — Skeleton & Export

### 4.1 The Lead Fields Contract

This is the **single source of truth** for all column names used in import, export, and skeleton generation. Define it as a constant array in a shared config file.

**File:** `src/config/leadImportExportConfig.js`

```js
/**
 * LEAD_EXCEL_COLUMNS
 * Ordered array defining every column in the import/export Excel file.
 * - `key`     : the Firestore field name on the lead document
 * - `header`  : the exact Excel column header string (shown in row 1)
 * - `required : whether the field is required for a valid import row
 * - `type`    : used for validation during import ('string' | 'number' | 'email' | 'tel')
 */
export const LEAD_EXCEL_COLUMNS = [
  { key: 'projectTitle',       header: 'Project Title',          required: true,  type: 'string' },
  { key: 'source',             header: 'Source',                 required: true,  type: 'string' },
  { key: 'category',           header: 'Category',               required: true,  type: 'string' },
  { key: 'description',        header: 'Description',            required: true,  type: 'string' },
  { key: 'clientName',         header: 'Client Name',            required: true,  type: 'string' },
  { key: 'phoneNumber',        header: 'Phone Number',           required: true,  type: 'tel'    },
  { key: 'email',              header: 'Email Address',          required: true,  type: 'email'  },
  { key: 'estimatedBilling',   header: 'Estimated Billing (₹)',  required: true,  type: 'number' },
  { key: 'estimatedBudget',    header: 'Estimated Budget (₹)',   required: true,  type: 'number' },
];

// Derived arrays for convenience:
export const LEAD_HEADERS = LEAD_EXCEL_COLUMNS.map(col => col.header);
export const LEAD_KEYS    = LEAD_EXCEL_COLUMNS.map(col => col.key);
```

This config is imported by every function in Phase 4 and Phase 5. Never hardcode column names in component JSX.

---

### 4.2 Excel Service — `excelService.js`

**File:** `src/services/excelService.js`

Import SheetJS at the top:
```js
import * as XLSX from 'xlsx';
import { LEAD_EXCEL_COLUMNS, LEAD_HEADERS } from '../config/leadImportExportConfig';
```

---

#### Function 1 — `downloadSkeletonSheet()`

**Purpose:** Generates and immediately downloads a blank `.xlsx` file with only the header row populated. Used by the "Download Template" button.

**Logic flow:**
```
1. Create a new workbook: XLSX.utils.book_new()

2. Build a single array-of-arrays for the worksheet:
   const wsData = [LEAD_HEADERS]
   // This produces: [['Project Title', 'Source', 'Category', ...]]

3. Create worksheet from data: XLSX.utils.aoa_to_sheet(wsData)

4. Apply column widths for readability:
   ws['!cols'] = LEAD_EXCEL_COLUMNS.map(() => ({ wch: 25 }))
   // wch = width in characters; 25 is comfortable for all field names

5. Append sheet to workbook: XLSX.utils.book_append_sheet(wb, ws, 'Leads Template')

6. Trigger download: XLSX.writeFile(wb, 'Wavelet_Leads_Import_Template.xlsx')
   // writeFile uses a browser anchor tag internally — no server needed
```

---

#### Function 2 — `exportLeadsToExcel(leads)`

**Purpose:** Takes the full leads array from Firestore and downloads an `.xlsx` file with one row per lead, columns matching the import template exactly.

**Parameters:** `leads` — array of Firestore lead document objects.

**Logic flow:**
```
1. Map leads array to rows-of-arrays using LEAD_EXCEL_COLUMNS order:
   const rows = leads.map(lead =>
     LEAD_EXCEL_COLUMNS.map(col => lead[col.key] ?? '')
   )
   // This guarantees column order is always identical to LEAD_HEADERS

2. Prepend the header row:
   const wsData = [LEAD_HEADERS, ...rows]

3. Create worksheet: XLSX.utils.aoa_to_sheet(wsData)

4. Apply column widths: same as skeleton (wch: 25)

5. Append to workbook: sheet name = 'Leads Export'

6. Generate filename with timestamp:
   const timestamp = format(new Date(), 'yyyy-MM-dd')  // date-fns
   XLSX.writeFile(wb, `Wavelet_Leads_Export_${timestamp}.xlsx`)
```

---

#### Function 3 — `parseLeadsFromExcel(file)`

**Purpose:** Takes a `.xlsx` File object from a file input, parses it, maps columns by header name, and returns a structured array of row objects ready for the staging table. This is an async function.

**Parameters:** `file` — File object from `<input type="file" />`.

**Returns:** `Promise<{ rows: ParsedRow[], errors: string[] }>`

**Logic flow:**
```
1. Read file as ArrayBuffer:
   const buffer = await file.arrayBuffer()

2. Parse workbook:
   const wb = XLSX.read(buffer, { type: 'array' })

3. Get first sheet:
   const ws = wb.Sheets[wb.SheetNames[0]]

4. Convert to array of objects (header row becomes keys):
   const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' })
   // defval: '' fills empty cells with empty string instead of undefined

5. Map each rawRow using LEAD_EXCEL_COLUMNS:
   const rows = rawRows.map((rawRow, index) => {
     const mapped = {}
     LEAD_EXCEL_COLUMNS.forEach(col => {
       mapped[col.key] = rawRow[col.header] ?? ''
     })
     return {
       _rowIndex: index,      // used for editing in the staging table
       _errors:   [],         // populated by the validator below
       ...mapped,
     }
   })

6. Validate each row (see §5.3 for validation rules):
   const { validatedRows, errors } = validateParsedRows(rows)

7. Return { rows: validatedRows, errors }
```

---

### 4.3 `<ImportExportPage />` — Page Layout

**File:** `src/pages/ImportExport/ImportExportPage.jsx`

**State variables:**

```
parsedRows      : array    — rows from parseLeadsFromExcel, default []
fileError       : string   — parsing or validation error message, default null
isUploading     : boolean  — true while batch-writing to Firestore, default false
uploadResult    : { success: number, failed: number } | null
allLeads        : array    — from useLeads() hook for export (existing hook)
isExporting     : boolean  — true while export function runs, default false
isDragging      : boolean  — for dropzone visual feedback, default false
```

**Layout structure:**

```
<ImportExportPage>
  │
  ├── Page Header: "Import / Export Hub"
  │
  ├── Two-column grid (md:grid-cols-2) — top section:
  │     ├── LEFT:  <ExportPanel />
  │     └── RIGHT: <SkeletonDownloadPanel />
  │
  └── Full-width — bottom section (conditionally rendered):
        <ImportPanel />       ← upload dropzone (always visible)
        <StagingTable />      ← only renders when parsedRows.length > 0
```

---

### 4.4 `<ExportPanel />`

**File:** `src/pages/ImportExport/components/ExportPanel.jsx`

**Props:** `{ leads, isExporting, onExport }`

**UI:**
```
Panel with border, rounded corners, padding.
Title: "Export Leads"
Description: "Download all leads in the CRM as an Excel spreadsheet."

Stats row:
  "Total leads: {leads.length}"
  "Converted: {leads.filter(l => l.isConvertedToOpportunity).length}"

Button: [Download Excel  ↓]
  - Icon: Download (Lucide)
  - Disabled + spinner when isExporting === true
  - onClick: onExport()
  - Tailwind: bg-green-600 hover:bg-green-700 text-white ...
```

**`onExport` handler (defined in `ImportExportPage`):**
```js
const handleExport = async () => {
  setIsExporting(true);
  try {
    await exportLeadsToExcel(allLeads);  // from excelService.js
  } finally {
    setIsExporting(false);
  }
};
```

---

### 4.5 `<SkeletonDownloadPanel />`

**File:** `src/pages/ImportExport/components/SkeletonDownloadPanel.jsx`

**UI:**
```
Panel with border, rounded corners, padding.
Title: "Download Import Template"
Description: "Download the blank Excel template with correct column headers
              before preparing your leads for import."

Column preview (small pills for each header):
  {LEAD_HEADERS.map(h => <span className="...pill...">{h}</span>)}

Button: [Download Template  ↓]
  - Icon: FileSpreadsheet (Lucide)
  - onClick: downloadSkeletonSheet()  — synchronous, no loading state needed
  - Tailwind: bg-blue-600 hover:bg-blue-700 text-white ...
```

✅ **Phase 4 complete checkpoint:** Template download works. Export download produces correctly formatted `.xlsx` with all lead fields. Both buttons render and are accessible admin-only.

---

## Phase 5: Import/Export Hub — Import & Staging UI

### 5.1 `<ImportPanel />` — File Upload Dropzone

**File:** `src/pages/ImportExport/components/ImportPanel.jsx`

**Props:** `{ onFileParsed, fileError, isDragging, setIsDragging }`

**Refs:**
```
fileInputRef: useRef(null)  — for programmatic trigger of the hidden file input
```

**Drag-and-drop events to handle on the dropzone `<div>`:**
```
onDragOver  → e.preventDefault(); setIsDragging(true)
onDragLeave → setIsDragging(false)
onDrop      → e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0])
onClick     → fileInputRef.current.click()
```

**Hidden file input:**
```jsx
<input
  type="file"
  ref={fileInputRef}
  accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  className="hidden"
  onChange={(e) => handleFile(e.target.files[0])}
/>
```

**`handleFile(file)` logic:**
```
1. If !file, return.
2. If file.name does not end with '.xlsx':
   Show error: "Only .xlsx files are supported."
   Return.
3. Call parseLeadsFromExcel(file) — async.
4. On resolve: call onFileParsed(rows) → sets parsedRows in parent.
5. On reject: set fileError with the thrown message.
```

**Dropzone visual states:**
```
Default:       border-dashed border-2 border-gray-300 bg-gray-50
Dragging over: border-blue-500 bg-blue-50
Has error:     border-red-400 bg-red-50

Content (centered):
  Icon: Upload (Lucide, size 32)
  Primary text: "Drop your .xlsx file here, or click to browse"
  Secondary text: "File must match the template format. Max 1000 rows."
```

---

### 5.2 `<StagingTable />` — Editable Preview Grid

**File:** `src/pages/ImportExport/components/StagingTable.jsx`

**Props:**
```
rows          : array    — parsedRows from parent
onRowsChange  : function — (updatedRows) => void — updates parent state on every cell edit
onSendToLeads : function — async — triggers the Firestore batch write
isUploading   : boolean
uploadResult  : { success, failed } | null
```

**Internal state:**
```
None — all state is lifted to ImportExportPage. This is a controlled component.
```

**UI structure:**

```
Header row:
  "Staging Area — {rows.length} rows ready to import"
  [Clear  ✕]    [Send to Leads  →]    ← action buttons (right-aligned)

Scrollable table container (overflow-x-auto):
  <table className="min-w-full text-sm">
    <thead>
      <tr>
        <th>#</th>
        {LEAD_EXCEL_COLUMNS.map(col => <th>{col.header}</th>)}
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row, idx) => <StagingTableRow />)}
    </tbody>
  </table>

If uploadResult is not null:
  Show a result banner:
    "✅ {uploadResult.success} leads imported successfully.
     ❌ {uploadResult.failed} rows failed. Review errors above."
```

---

### 5.3 `<StagingTableRow />` — Editable Row

**File:** `src/pages/ImportExport/components/StagingTableRow.jsx`

**Props:**
```
row        : ParsedRow object
rowIndex   : number
onChange   : (rowIndex, key, newValue) => void
```

**Rendering rules:**

Each cell renders an `<input>` (or `<textarea>` for `description`). This makes every field editable in-place.

```jsx
// For each column in LEAD_EXCEL_COLUMNS:
<td key={col.key}>
  <input
    type={col.type === 'number' ? 'number' : 'text'}
    value={row[col.key]}
    onChange={(e) => onChange(rowIndex, col.key, e.target.value)}
    className={`
      w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1
      ${row._errors?.includes(col.key)
        ? 'border-red-400 bg-red-50 focus:ring-red-400'
        : 'border-gray-200 focus:ring-blue-400'
      }
    `}
  />
</td>
```

**Status column (last cell):**
```
If row._errors.length === 0: green ✓ "Valid" chip
If row._errors.length > 0:   red   ✗ "{n} error(s)" chip — on hover show tooltip listing error fields
```

**`onChange` handler (defined in `StagingTable`, passed down):**
```js
const handleCellChange = (rowIndex, key, value) => {
  const updatedRows = rows.map((row, i) => {
    if (i !== rowIndex) return row;
    const updatedRow = { ...row, [key]: value };
    // Re-validate this row in real-time:
    updatedRow._errors = validateSingleRow(updatedRow);
    return updatedRow;
  });
  onRowsChange(updatedRows);
};
```

---

### 5.4 Row Validation — `validateParsedRows()` and `validateSingleRow()`

**File:** `src/utils/leadImportValidator.js`

**`validateSingleRow(row)`**

Returns an array of `key` strings for every field that fails validation:

```
Validation rules per column type:
  - All required fields: row[key].toString().trim() === '' → add key to errors
  - type: 'email':  must match /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  - type: 'tel':    must match /^[0-9+\s\-()]{7,15}$/
  - type: 'number': must be a valid number AND >= 0
  - source:         must be one of ['Referral', 'LinkedIn', 'Cold Call', 'Website', 'Email Campaign', 'Other']
  - category:       must be one of ['Hot', 'Neutral', 'Cold']  (case-sensitive — Excel must match)

Returns: string[] of failing keys (empty array = row is valid)
```

**`validateParsedRows(rows)`**

```
Applies validateSingleRow to each row.
Sets row._errors on each row.
Returns: { validatedRows, errors: string[] }
  - errors is a summary array: e.g. ["Row 3: Email Address is invalid", ...]
  - Used to display a toast/banner after parsing, not per-cell (per-cell errors come from _errors)
```

---

### 5.5 "Send to Leads" Firestore Batch Write

**File:** `src/services/leadsImportService.js`

```js
import {
  collection, doc, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { LEAD_EXCEL_COLUMNS } from '../config/leadImportExportConfig';

/**
 * Batch-writes all valid staging rows to the Firestore `leads` collection.
 * Skips rows that still have _errors.
 * Uses Firestore writeBatch (max 500 writes per batch — chunk automatically).
 *
 * @param {ParsedRow[]} rows     - Validated staging rows
 * @param {string}      adminUid - Current admin's UID
 * @returns {Promise<{ success: number, failed: number }>}
 */
export async function batchWriteLeads(rows, adminUid) {
  const validRows   = rows.filter(r => r._errors.length === 0);
  const invalidCount = rows.length - validRows.length;

  if (validRows.length === 0) {
    return { success: 0, failed: invalidCount };
  }

  const leadsCol = collection(db, 'leads');
  let successCount = 0;
  const BATCH_SIZE = 499; // Firestore limit is 500; use 499 for safety

  // Split into chunks to handle > 500 rows
  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const chunk = validRows.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((row) => {
      const newDocRef = doc(leadsCol);

      // Build the Firestore payload from staging row data:
      const payload = {
        leadId:                    newDocRef.id,
        projectTitle:              row.projectTitle.trim(),
        source:                    row.source.trim(),
        category:                  row.category.toLowerCase().trim(), // store as 'hot'/'neutral'/'cold'
        description:               row.description.trim(),
        clientName:                row.clientName.trim(),
        phoneNumber:               row.phoneNumber.toString().trim(),
        email:                     row.email.trim(),
        estimatedBilling:          Number(row.estimatedBilling),
        estimatedBudget:           Number(row.estimatedBudget),

        // System fields — identical to CreateLeadModal's defaults:
        phase:                     'open',
        isConvertedToOpportunity:  false,
        convertedOpportunityId:    null,
        convertedToOpportunityAt:  null,
        convertedToOpportunityBy:  null,
        isDeleted:                 false,
        createdAt:                 serverTimestamp(),
        createdBy:                 adminUid,
        updatedAt:                 serverTimestamp(),
        updatedBy:                 adminUid,

        // Mark as imported for potential filtering/auditing:
        importSource:              'excel_import',
      };

      batch.set(newDocRef, payload);
      successCount++;
    });

    await batch.commit();
  }

  return { success: successCount, failed: invalidCount };
}
```

**"Send to Leads" button handler (in `ImportExportPage`):**
```js
const handleSendToLeads = async () => {
  setIsUploading(true);
  setUploadResult(null);
  try {
    const result = await batchWriteLeads(parsedRows, currentUser.uid);
    setUploadResult(result);
    if (result.success > 0) {
      // Clear only the successfully imported rows; keep failed ones for correction
      setParsedRows(prev => prev.filter(r => r._errors.length > 0));
    }
  } catch (err) {
    setFileError(`Batch write failed: ${err.message}`);
  } finally {
    setIsUploading(false);
  }
};
```

✅ **Phase 5 complete checkpoint:** Admin can upload an `.xlsx` file, see parsed data in an editable table, fix validation errors inline, and batch-import to Firestore. Imported leads appear immediately in the Leads section via `onSnapshot`. Export downloads correctly.

---

## Phase 6: Firebase Security Rules Updates

Append to `firestore.rules`. Do not modify existing rules.

```javascript
// ── Analytics Dashboard ────────────────────────────────────────────────────
// The analytics dashboard reads from 'projects', 'users', and the 'shifts'
// collection group. The 'projects' and 'users' rules are assumed to already
// permit admin reads. Add this only if they do not:

// Collection group read for shifts (required for WorkerHoursBarChart):
match /{path=**}/shifts/{shiftId} {
  allow read: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ['admin', 'super_admin'];
}

// ── Import / Export Hub ────────────────────────────────────────────────────
// Leads batch import — extends existing leads create rule to allow
// admin bulk creation with the importSource field present:
match /leads/{leadId} {
  // If the existing rule does not already cover admin creation:
  allow create: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
      in ['admin', 'super_admin'];
}

// ── No Storage rules required ──────────────────────────────────────────────
// Import/Export only reads and writes Excel files client-side via SheetJS.
// No files are uploaded to Firebase Storage for this module.
```

**Required Firestore index deployment:**
```bash
firebase deploy --only firestore:indexes
firebase deploy --only firestore:rules
```

---

## Phase 7: File Structure Reference

Complete list of all new files created by this implementation:

```
src/
├── config/
│   └── leadImportExportConfig.js          ← LEAD_EXCEL_COLUMNS master contract
│
├── hooks/
│   └── useAnalyticsData.js                ← 3 onSnapshot listeners
│
├── utils/
│   ├── analyticsEngine.js                 ← 5 pure compute functions
│   └── leadImportValidator.js             ← validateSingleRow, validateParsedRows
│
├── services/
│   ├── excelService.js                    ← downloadSkeletonSheet, exportLeadsToExcel,
│   │                                         parseLeadsFromExcel
│   └── leadsImportService.js              ← batchWriteLeads
│
└── pages/
    ├── Analytics/
    │   ├── AnalyticsDashboardPage.jsx
    │   └── components/
    │       ├── KPICardsRow.jsx
    │       ├── KPICard.jsx
    │       ├── RevenueVsCostBarChart.jsx
    │       ├── ProjectStatusPieChart.jsx
    │       ├── MonthlyRevenueTrendChart.jsx
    │       ├── WorkerHoursBarChart.jsx
    │       ├── SalaryTypeDistributionPieChart.jsx
    │       ├── EmptyChartState.jsx
    │       └── AnalyticsSkeleton.jsx
    │
    └── ImportExport/
        ├── ImportExportPage.jsx
        └── components/
            ├── ExportPanel.jsx
            ├── SkeletonDownloadPanel.jsx
            ├── ImportPanel.jsx
            ├── StagingTable.jsx
            └── StagingTableRow.jsx
```

**Files modified (surgical changes only):**

| File | Change |
|------|--------|
| `vite.config.js` | Add `define: { global: 'globalThis' }` only if SheetJS Buffer error occurs |
| Router config file | Add two new protected routes for `/analytics` and `/import-export` |
| Sidebar / Nav component | Add two new admin-only nav links |
| `firestore.indexes.json` | Add collection group index for `shifts` |
| `firestore.rules` | Add collection group read rule for shifts analytics |

---

## Appendix: Data Guard Rules for Chart Components

Every chart component must guard against empty or malformed data. Apply these checks **before** passing data to Recharts — Recharts does not handle undefined/empty `data` arrays gracefully and will throw console errors:

```js
// Pattern to apply at the top of every chart component:
if (!data || data.length === 0) {
  return <EmptyChartState message="..." />;
}

// For numeric values in tooltips and labels — always guard division:
const safeDivide = (a, b) => (b === 0 ? 0 : a / b);

// For currency display inside Recharts Tooltips (can't use formatINR directly in some versions):
// Use the formatter prop: formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'label']}
```
