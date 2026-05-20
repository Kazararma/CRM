# CRM System Documentation

This document provides a comprehensive overview of the CRM application, detailing its features, user interface (UI), workflows, and underlying technology stack. Special emphasis is placed on the **Leads Management** module, which serves as the core pipeline for prospective clients.

---

## 1. Technology Stack

The CRM is built as a modern, responsive, single-page application (SPA) using a robust and scalable frontend technology stack backed by a serverless database.

### Core Technologies
*   **Framework:** React 19 (via Vite)
*   **Routing:** React Router v7
*   **Database & Backend:** Firebase (Firestore for database, Firebase Authentication for role-based access control)
*   **Styling:** Tailwind CSS for utility-first, responsive, and highly customizable designs.
*   **Components & UI:** 
    *   `@headlessui/react` for accessible, unstyled interactive components (Dialogs, Transitions, Modals).
    *   `lucide-react` for consistent, scalable SVG iconography.
*   **Date Formatting:** `date-fns` for lightweight date manipulation and formatting.
*   **Forms:** `react-hook-form` for efficient form state management and validation.

---

## 2. General CRM Features

The CRM is designed with role-based access control (Admin, Super Admin, Worker) and focuses on managing the entire lifecycle of a client—from an initial inquiry to a completed project.

*   **Role-Based Access Control (RBAC):** Strict navigation guards (e.g., only `admin` and `super_admin` can access the Leads section).
*   **Projects Management:** A centralized view for active projects with team assignments, milestones, and status tracking.
*   **Financial Tracking:** Integrated real-time monitoring of estimated budgets versus actual payments, calculating projected margins.
*   **User/Team Directory:** A centralized place to view team member productivity and work logs.

---

## 3. Leads Management Section (Deep Dive)

The Leads Management section is the negotiation and pre-sales hub of the CRM. It allows admins to track prospective clients, log communications, negotiate financials, and eventually convert successful leads into active projects.

### 3.1. User Interface (UI) Overview

The UI is designed to be clean, informative, and action-oriented, utilizing a Kanban-style layout for easy visual tracking.

*   **Metrics Bar:** A top-level dashboard providing immediate insights:
    *   **Active Leads:** Total pending leads in the pipeline.
    *   **Category Breakdown:** Visual counts of leads categorized by temperature (*Hot, Neutral, Cold*).
    *   **Converted Leads:** Total count of successfully won leads.
    *   **Total Converted Value:** Cumulative financial value (in INR) of all won deals.
*   **Kanban Board:** Leads are visually separated into three primary columns based on their category: **Hot** (Red), **Neutral** (Yellow), and **Cold** (Blue).
*   **Lead Cards:** Compact, interactive cards displaying essential information: Project Title, Client Contact Info, Current Phase Badge, Estimated/Final Billing amount, and Creation Date. A prominent overlay appears if a lead is converted.
*   **Time & Phase Filters:** Dropdowns to filter the Kanban board by specific timeframes (e.g., *This Month*) and phases (e.g., *Initial, Negotiation, Final*).

### 3.2. Core Features & Capabilities

*   **Lead Creation (`CreateLeadModal`):** 
    *   Captures fundamental details: Project Title, Source (Referral, LinkedIn, Cold Call, etc.), Category, Description.
    *   Captures contact information (Name, Email, Phone).
    *   Captures financial estimates: **Estimated Billing** (what the company plans to charge) and **Estimated Budget** (the internal cost to execute).
*   **Lead Detail View (`LeadDetailModal`):** A comprehensive, multi-tab modal that serves as the command center for a single lead.
    *   **Overview Tab:** Displays description, contact details, and initial financial estimates.
    *   **Logs Tab (`LeadLogsPanel`):** A chronological communication timeline. Users can add notes and updates. Every log captures the user's name, timestamp, and the *phase the lead was in* when the log was created.
    *   **Financials Tab (`LeadFinancialsPanel`):** A dynamic panel that adapts based on the lead's current phase (detailed in the Workflow section below).

### 3.3. The Lead Workflow (Phase Progression)

A lead moves through a strict lifecycle defined by "Phases". The system dynamically adjusts the UI and available actions based on the current phase.

1.  **Initial Phase (Default):**
    *   The lead has just been created. 
    *   *Financials:* Locked/Read-only. Displays only the original Estimated Billing and Budget.
2.  **Negotiation Phase:**
    *   Active discussions are happening with the client.
    *   *Financials:* Unlocked. Admins can input and save real-time negotiation metrics:
        *   **Asked from Client:** The quoted amount.
        *   **Client Agreed On:** The finalized negotiated price. (This overrides the Final Billing amount).
        *   **Client Paid Amount:** Any advance payments received.
    *   The system automatically calculates the **Outstanding Balance** and **Projected Margin** (Agreed amount minus Estimated Budget), using visual indicators (Red/Green) to warn if the margin becomes negative.
3.  **Final Phase:**
    *   Negotiations have concluded successfully.
    *   *Financials:* Locked/Read-only. The agreed-upon amounts are finalized.
    *   *Action:* The lead is now eligible to be converted into an active Project.
4.  **Failed Phase:**
    *   The deal fell through.
    *   *Financials:* Locked/Read-only.
    *   *Action:* The lead can be permanently deleted by the admin.

### 3.4. The Conversion Process (`convertLeadToProject`)

When a lead reaches the **Final** phase, it can be transitioned into a full-fledged Project. This is a critical, irreversible workflow.

1.  **Confirmation Screen:** The admin is presented with a clear confirmation screen displaying the final agreed billing amount to ensure accuracy before locking the lead.
2.  **Atomic Database Transaction:** The `leadsService` uses a Firestore `writeBatch` to ensure data integrity across three simultaneous operations:
    *   **Create Project:** A new document is created in the `projects` collection, prepopulated with the lead's details (Title, Description, Client Info, Final Billing, Budget, Amount Paid). It is set to a `pending` status, awaiting admin assignment of workers and deadlines. It also stores a `sourceLeadId` for traceability.
    *   **Lock Lead:** The original lead document is updated with `isConverted: true` and linked to the new `convertedProjectId`. This permanently locks the lead from further edits in the Kanban board.
    *   **Log Action:** An automated log entry is added to the lead's history, recording exactly who converted it and when.

### 3.5. Automated Logging

The system heavily relies on automated logging to maintain an audit trail. 
*   Whenever a lead's phase is changed (e.g., Initial -> Negotiation), the system automatically generates a log entry in the `lead_logs` subcollection documenting the change and the user responsible.
*   The conversion event is also automatically logged.

---

## 4. Summary

The CRM's Leads section provides a highly structured, visually intuitive pipeline. By enforcing a strict phase-based progression, dynamically locking/unlocking financial inputs, and utilizing atomic database transactions for conversions, the system ensures data integrity, clear auditability, and a seamless handoff from the sales team to the project management team.
