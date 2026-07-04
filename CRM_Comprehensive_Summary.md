# Wavelet CRM SAAS - Comprehensive System Summary

## 1. Overview & Technology Stack
Wavelet CRM is a modern, enterprise-grade Single Page Application (SPA) designed to bridge client acquisition, project execution, automated payroll, and financial invoicing. It utilizes a serverless architecture for real-time synchronization and scalable performance.

**Technology Stack:**
*   **Frontend Core**: React 18, Vite (for fast HMR and builds), React Router DOM.
*   **Styling & UI**: Tailwind CSS v3.4 (utility-first), Headless UI (accessible unstyled components), Lucide React (icons), Recharts (dashboards).
*   **Data Handling**: React Hook Form (performant form validation), `date-fns` (date formatting), `xlsx` (Excel parsing/generation).
*   **Document Generation**: React PDF (`@react-pdf/renderer`) for native browser PDF generation.
*   **Backend & Cloud**: Firebase v12.13 (Firestore NoSQL real-time DB, Firebase Storage for assets, Firebase Auth for RBAC).

---

## 2. Core Workflows & Project Execution
*   **Role-Based Access Control (RBAC)**: Distinct permissions for `super_admin`, `admin`, and `worker`.
*   **Live Budget & Execution Tracking**: Real-time calculation of overhead expenses, labor costs, and realized profits.
*   **Labor & Shift Tracking**: Workers use a floating shift timer (global timer). Work logs must be submitted with valid proof (PDF/PNG) to validate shifts and unlock payroll.
*   **Smart Salary Engine**: Supports Project-based, Monthly, and Hourly compensation structures with a secure "Payment Handshake" verification loop.
*   **Automated PDF Invoicing**: Single-click invoice generation pre-populated with client details and outstanding balances.

---

## 3. Leads Management Pipeline
The Leads section is an exclusive module for admins, functioning as an advanced CRM to track potential clients and manage project acquisition.

### 3.1 Lead Categories & Phases
Leads flow through a Kanban-style interface:
*   **Categories (Immutable check)**: Hot (🔴), Neutral (🟡), Cold (🔵).
*   **Phases (Progression)**:
    1.  **Initial**: Default state.
    2.  **Negotiation**: Active quoting and budgeting phase.
    3.  **Final**: Terminal phase pending project conversion.
    4.  **Failed**: Soft-deleted state.

### 3.2 Lead Creation & Financial Estimations
Creating a lead requires a comprehensive form, including source attribution (Referral, LinkedIn, etc.), and contact details. Crucially, it sets **Estimated Billing** (revenue) and **Estimated Budget** (cost).

### 3.3 The Negotiation Engine
During the `negotiation` phase, admins interact with the Negotiation Financial Engine to log:
*   **Asked From Client**: The initial quoted price.
*   **Client Agreed On**: The finalized locked revenue.
*   **Client Paid Amount**: Any initial advances received.
This automatically calculates margins and outstanding balances in real-time.

### 3.4 The Conversion Handshake (Lead → Project)
Once a lead is in the `final` phase, admins can trigger the conversion. A Firestore batch transaction atomically creates a new live Project document mapped directly from the finalized lead data and locks the lead document as `isConverted: true`. 

---

## 4. The Import and Export Hub
Designed for bulk data ingestion and extraction with a heavy focus on data integrity.

### 4.1 Export Architecture
Admins can extract the entire lead database. The system utilizes the `xlsx` library to map Firestore JSON objects into a fully formatted `.xlsx` spreadsheet and triggers an automatic browser download.

### 4.2 Import Architecture & Data Staging
1.  **Skeleton Template**: Users download a rigidly formatted Excel template to ensure column header matching.
2.  **File Upload**: Drag-and-drop validation for `.xlsx` files. The sheet is parsed into JavaScript objects.
3.  **The Staging Area**: Data is NOT written to the database yet. It enters a staging table where every row is validated against strict rules (e.g., required fields, email format).
4.  **In-Line Correction**: Rows with errors are highlighted red. Users can edit cells directly in the table, triggering real-time re-validation.
5.  **Atomic Commit Phase**: The "Commit Leads" button is disabled until 0 errors remain. Upon clicking, a Firebase batch operation safely writes all valid leads atomically, preventing partial corruption.

---

## 5. Autonomous AI Workflow & Agency OS
The CRM is designed to operate as an active Autonomous Agency OS, meaning it can auto-dial or message leads instantly upon import.

### 5.1 BYOK Encryption (Bring Your Own Key)
Admins configure API keys for AI outreach (Twilio, Vapi/Retell) via the Settings tab. To ensure maximum security, keys are verified and then encrypted using AES-256-GCM in a secure Firebase Cloud Function. Plaintext keys are never stored in Firestore; decryption only happens in-memory during dispatch.

### 5.2 Context Crawler & Master Prompt Generation
To prevent AI hallucinations, the system features an Auto-Onboarding Crawler:
1.  Admin inputs their company website URL.
2.  A headless browser (Playwright) crawls the site (About, Services, Pricing, FAQs).
3.  The extracted text is pushed to an LLM (GPT-4o-mini) to generate a "Master AI System Prompt."
4.  This prompt instructs the voice AI on company services, minimum budgets, and qualification criteria.

### 5.3 AI Import Pipeline & Autonomous Dispatch
When importing leads, admins can toggle the **Autonomous AI Outreach** switch:
*   Enforces stricter validation (requires E.164 formatted phone numbers).
*   Allows selection of the channel: **🎙 AI Voice Call (Vapi)** or **💬 WhatsApp Message (Twilio)**.
*   Accepts a **Campaign Context** (e.g., "Offer the 15% Summer Discount").

**The AI Dispatch Flow:**
1.  **Commit**: Leads are written to Firestore via batch write.
2.  **Task Queue**: A Cloud Function (`dispatchLeadBatchToTaskQueue`) queues a delayed background task for every new lead.
3.  **Execution (`processLeadTask`)**: 
    *   Decrypts tenant keys in memory.
    *   Initiates an outbound AI phone call via Vapi (or WhatsApp via Twilio).
    *   The AI agent uses the scraped Master System Prompt + Campaign Context to intelligently qualify the lead.
4.  **State Updates**: Lead statuses in Firestore are automatically updated to "dispatched", tracking the progress of the autonomous AI agent.
