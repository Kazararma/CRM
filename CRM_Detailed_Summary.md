# CRM Platform Detailed Summary (Features & Tech Stack)

A real-time, enterprise-grade business management platform that seamlessly bridges client acquisition, project execution, worker productivity, and automated payroll.

---

## 💻 Tech Stack & Architecture

### **Frontend**
* **React 18 (via Vite):** Core SPA framework utilizing fast Hot Module Replacement (HMR).
* **React Router v6:** Manages client-side routing, protected route guards, and role-based access control (RBAC).
* **Tailwind CSS:** Responsive, utility-first styling designed for mobile and desktop screens.
* **Headless UI:** Provides accessible, unstyled dialogs, tabs, and select components.
* **Lucide React:** Icon library for consistent SVG icons.
* **React Hook Form:** Handles client-side form validation and input state management.

### **Backend & Infrastructure**
* **Firebase Firestore:** Core NoSQL document database. Leverages real-time listeners (`onSnapshot`) to push updates instantly across all active clients.
* **Firebase Authentication:** Handles user sign-in exclusively via Google Sign-In, mapped to user profile roles in Firestore.
* **Firestore Security Rules:** Server-side rules that validate permissions and enforce RBAC:
  * `super_admin`: Full system control + admin management privileges.
  * `admin`: Complete control of projects, financials, opportunities, and shift approvals.
  * `worker`: Restricted access. Can only view the Dashboard and interact with assigned projects.

---

## ✨ Core Features & Modules

### 🎯 1. Acquisition Pipeline (Leads & Opportunities)
* **The 3-Stage CRM Pipeline:**
  ```
  Lead (qualified) ➔ Opportunity (closed_won) ➔ Project
  ```
* **Legacy-Safe Leads:** A normalizer utility maps legacy phases (`initial`, `negotiation`, `final`, `failed`) into modern labels (`open`, `contacted`, `qualified`, `unqualified`) at read-time, leaving historical Firestore data untouched.
* **10-Stage Opportunity Funnel:** A Kanaban board tracks deals from *Prospecting* through to terminal *Closed Won* / *Closed Lost* phases.
* **Atomic Handshakes:** Firestore batch writes execute conversions (e.g., converting a qualified Lead to an Opportunity, or a Closed Won Opportunity to a Project) in single atomic transactions to guarantee zero data loss.

### ⏱️ 2. Labor & Shift Tracking
* **Global Shift Timer:** A persistent float timer allows workers to clock in and out against assigned projects, logging active minutes.
* **Anti-Idle Heartbeat:** Protects from "ghost hours" by checking active presence periodically.
* **Shift Validation:** Admins validate/deny completed shifts before they flow into payroll.

### 💰 3. Smart Salary Engine
* **Tri-Factor Compensation:** Native support for Project-based (with overtime logic), Monthly (eligibility check), and Hourly compensation structures.
* **Payment Handshake Loop:** A multi-step status flow (`Initiate Payment` ➔ `Pending` ➔ `Salary Received` or `Disputed`) keeps financial interactions transparent.

---

## 🖥️ Deep Dive: The Dashboard & Project Cards

The **Dashboard Page** ([DashboardPage.jsx](file:///c:/dev/crm/src/pages/DashboardPage.jsx)) serves as the main activity workspace. It groups projects under status tabs (**Ongoing**, **Completed**, **Cancelled**). Projects are rendered as interactive **Project Dashboard Cards** ([ProjectDashboardCard.jsx](file:///c:/dev/crm/src/components/dashboard/ProjectDashboardCard.jsx)).

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Avatars] [Project Title]                                 [Progress] │
│──────────────────────────────────────────────────────────────────────│
│ ┌──────────────────────┐  ┌────────────────────────────────────────┐ │
│ │ Left Column          │  │ Right Column                           │ │
│ │                      │  │                                        │ │
│ │ • Stage Selector     │  │ • Work Log Section                     │ │
│ │ • Awaiting Validation│  │   - Add Work Log / View Work Logs      │ │
│ │ • Live Financials    │  │ • Meeting Log Section                  │ │
│ │ • Project Notes      │  │   - Add Meeting / View Meeting Notes   │ │
│ └──────────────────────┘  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 1. **Collapsed State (Header / Summary)**
* **Assigned Members:** Displays profile picture/initial avatars for the workers and admins assigned to the project.
* **Project Metadata:** Renders the project title, updated timestamp, and the total count of assigned workers.
* **Progress Bar:** Renders the client payment ratio: `(amountPaid / totalBilling) * 100`.

### 2. **Expanded State (Left Column: Management & P&L)**
* **Stage Selector (`StageSelector.jsx`):** Allows status changes (`ongoing`, `completed`, `cancelled`). Triggers a confirmation dialog and creates a log entry in `stageChangeLogs` on confirm.
* **Awaiting Validation Section (Admin Only):** Displays live worker shifts waiting for approval. Admins see the worker's name, shift duration, task header, and description. Shows options to validate or deny/delete shifts individually or in batch.
* **Live Financial Breakdown (Admin Only):** Employs the `useProjectFinancials` hook to perform real-time financial math in INR (₹):
  * **Expenses (Overhead):** Fixed overhead base expenses.
  * **Labor Costs:** Computed from validated worker shifts.
  * **Total Cost:** Overhead Expenses + Labor Costs.
  * **Expected Profit:** Contract Value (`totalBilling`) - Total Cost.
  * **Realized Profit:** Client Payments (`amountPaid`) - Total Cost.
* **Project Notes:** Displays quick text-based notes.

### 3. **Expanded State (Right Column: Timelines & Activity)**
* **Work Log Section (`WorkLogSection.jsx`):** A chronological feed of all tasks completed. Workers use this to log headings and descriptions of work done.
* **Meeting Log Section (`MeetingLogSection.jsx`):** Keeps track of all syncs, showing the meeting date, time, mode (in-person, video, phone), topic, and detailed minutes.
