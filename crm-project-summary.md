# CRM Project Summary

## 1. Overview
This CRM (Customer Relationship Management) application is a modern, single-page application designed to manage leads, track project work logs, and monitor worker shifts and salaries. It leverages a serverless architecture for real-time data synchronization and scalable performance.

## 2. Technology Stack
The project is built on a cutting-edge frontend stack:
*   **Core Framework**: React (v19.2)
*   **Build Tool**: Vite
*   **Styling**: Tailwind CSS (v3.4) for utility-first styling.
*   **UI Components**: Headless UI for accessible, unstyled components (like Modals and Transitions).
*   **Icons**: Lucide React for consistent vector iconography.
*   **Form Management**: React Hook Form for performant, uncontrolled form validation.
*   **Routing**: React Router DOM (v7).
*   **Date Formatting**: Date-fns for manipulating and formatting timestamps.
*   **Backend as a Service (BaaS)**: Firebase (v12.13)
    *   *Firestore*: NoSQL database for structured data (Leads, Projects, Worklogs, Shifts).
    *   *Firebase Storage*: Object storage for file uploads (PDFs, PNGs).
    *   *Firebase Auth*: User authentication and role-based access.

---

## 3. Leads Section Focus

The Leads section manages potential clients and upcoming projects. It includes a Kanban-style interface (implied by `LeadPhaseSelector` and `LeadCard`) and detailed lead tracking.

### Feature Highlight: Lead Creation Modal (`CreateLeadModal.jsx`)
The lead creation process is handled by a responsive modal powered by Headless UI. When a user creates a new lead, they must fill out a comprehensive form that establishes both contact information and financial estimates.

#### Input Fields & Validation
1.  **Project Title** (`text`, required): The overarching name of the potential project (e.g., "Website Redesign").
2.  **Source** (`select`, required): Tracks lead attribution. Options include: *Referral, LinkedIn, Cold Call, Website, Email Campaign, Other*.
3.  **Category** (`select`, required): A temperature check on the lead's viability. Options include: *Hot, Neutral, Cold*.
4.  **Description** (`textarea`, required): A brief description of the project scope.
5.  **Client Name** (`text`, required): The name of the company or individual.
6.  **Phone Number** (`tel`, required): Contact phone number.
7.  **Email Address** (`email`, required): Contact email address.
8.  **Estimated Billing (₹)** (`number`, required, min: 0): The projected revenue from the lead.
9.  **Estimated Budget Cost (₹)** (`number`, required, min: 0): The projected cost to fulfill the project.

#### Under the Hood
When submitted, the form injects several default system fields into Firestore, such as `phase: 'open'`, timestamp tracking (`createdAt`, `updatedAt`), and lifecycle tracking variables (`isConvertedToOpportunity: false`, `isDeleted: false`).

---

## 4. Dashboard Section Focus

The Dashboard (specifically Project Dashboards) provides operational oversight on active work. A critical component of this is the **Work Logs** system, which acts as the bridge between project tasks and payroll validation.

### Feature Highlight: Work Log Submission (`WorkLogSection.jsx`)
Workers use this section to log their daily activities. These logs are rendered in a real-time feed on the dashboard and are strictly enforced for shift validation.

#### Input Fields & Validation
1.  **Log Heading** (`text`, required): A brief summary of the work (e.g., "UI Fixes").
2.  **Description** (`textarea`, required): A detailed account of what was accomplished during the shift.
3.  **Attach Proof** (`file input`, required conditionally based on validation rules):
    *   **Strict Constraints**: Only accepts `.pdf` and `.png` file types.
    *   **Size Limits**: Enforces a maximum file size of 5MB.
    *   *UX Note*: The standard HTML file input is hidden and replaced with a custom button (`stagedFile`) that provides visual feedback (green checkmark) when a valid file is selected.

#### Under the Hood
1.  **Storage Upload**: When submitted, the file is actively uploaded to Firebase Storage via `uploadWorklogAttachment`. A progress bar is displayed to the user using React state (`uploadProgress`).
2.  **Database Write**: The text metadata and the resulting Storage Download URL are saved to Firestore.
3.  **Auto-Validation Engine**: If the worker currently has an active shift (`associatedShiftId`), submitting this form with a valid attachment *automatically* triggers a Firestore update that marks their shift as `isValidated: true`, effectively unlocking their payroll for that time block.
