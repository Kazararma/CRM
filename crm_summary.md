# Wavelet CRM - Detailed System Summary

> A real-time, enterprise-grade business management platform designed to bridge client acquisition, project execution, automated payroll, and financial invoicing.

---

## 💻 Technology Stack

Wavelet CRM is a modern, full-stack Single Page Application (SPA) built for performance, real-time synchronization, and a seamless developer experience.

**Frontend Core:**
- **React 18**: The core UI library, running via **Vite** for lightning-fast HMR and optimized builds.
- **Tailwind CSS**: A utility-first CSS framework for rapid, responsive styling.
- **React Router DOM**: For client-side routing.

**UI & Visualization:**
- **Lucide React**: For highly scalable, customizable SVG iconography.
- **Recharts**: For rendering data visualizations and analytics dashboards.

**Data Handling & Utilities:**
- **React Hook Form**: For performant, flexible, and extensible form validation without unnecessary re-renders.
- **date-fns**: For reliable date manipulation and formatting.
- **xlsx**: To enable reading, writing, and parsing of Excel spreadsheets (crucial for data migrations).

**Document Generation:**
- **React PDF (`@react-pdf/renderer`)**: Generates client-ready, dynamic PDF invoices natively within the browser.
- **jspdf / jspdf-autotable**: Additional utilities for table-based PDF generation.

**Backend & Infrastructure:**
- **Firebase Firestore**: A NoSQL cloud database utilizing `onSnapshot` listeners to provide seamless, real-time data synchronization across all clients.
- **Firebase Authentication**: Secures the application and enables Role-Based Access Control (RBAC).

---

## ✨ Core Features

### 1. Acquisition Pipeline (Leads & Opportunities)
- **10-Stage Opportunity Funnel**: A dynamic Kanban board that tracks deals visually from *Prospecting* down to *Closed Won*.
- **Dynamic Financial Engine**: Automatically calculates margins, budgets, and outstanding balances based on the active phase.
- **Atomic Handshakes**: Utilizes Firestore batch writes to guarantee zero-data-loss when upgrading a Lead to an Opportunity, or an Opportunity to an active Project.

### 2. Project Execution
- **Live Budget Tracking**: Calculates overhead expenses, labor costs, and realized profits in real time.
- **Role-Based Assignment**: Securely assigns specific Workers and Admins to strictly isolated project scopes.

### 3. Labor & Shift Tracking
- **Floating Shift Timer**: A persistent, 60fps global timer allowing workers to log hours precisely against assigned projects without disrupting their workflow.
- **The "Online Heartbeat"**: An automated anti-idle system requesting worker confirmation to prevent "ghost hours."

### 4. Smart Salary Engine
- **Tri-Factor Compensation**: Built-in support for multiple compensation structures: Project-based, Monthly (20-day eligibility check), and Hourly.
- **The Payment Handshake**: A secure, two-way confirmation loop (`Initiate Payment` -> `Pending` -> `Salary Received` / `Disputed`) between Admins and Workers.

### 5. Automated PDF Invoicing Engine
- **Dynamic PDF Generation**: Renders professional PDF invoices directly in the browser.
- **Project Integration**: Single-click invoice generation straight from the Project dashboard, pre-populating client details and current outstanding balances.

---

## 🔍 Deep Dive: Lead Import and Export Section

The **Import & Export Hub** is a dedicated module designed to handle bulk lead data ingestion and extraction. It is engineered with user experience and data integrity in mind.

### 📤 Export Architecture
The export system allows administrators to extract the entire lead database into a universally accessible format.
- **`ExportPanel.jsx`**: Provides a clear interface indicating the number of leads available for export.
- **Data Fetching**: Hooks into the global `useLeads` context to fetch all leads currently in the system.
- **Excel Generation**: Relies on the `xlsx` library (`exportLeadsToExcel` service) to map JSON objects from Firestore into a clean, formatted `.xlsx` spreadsheet, triggering an automatic browser download.

### 📥 Import Architecture
The import pipeline is highly sophisticated, focusing on data sanitization and user review before database commit.

**1. Template Retrieval (`SkeletonDownloadPanel.jsx`)**
- Users can download a "Skeleton" template. This guarantees the user has an Excel file formatted with the precise column headers expected by the CRM, minimizing mapping errors during upload.

**2. File Upload (`ImportPanel.jsx`)**
- Supports both drag-and-drop and standard file browsing.
- Validates the file extension strictly to `.xlsx`.
- Passes the file to `parseLeadsFromExcel` which reads the workbook and converts the first sheet into an array of JavaScript objects.

**3. The Staging Area (`StagingTable.jsx` & `StagingTableRow.jsx`)**
- **Crucial Step**: Instead of writing directly to the database, uploaded data is placed into a "Staging Area".
- **Real-Time Validation**: Every row is processed through `validateLeadRow`. Any missing required fields or format anomalies are attached as `_errors` to the row object.
- **In-Line Correction**: The `StagingTableRow` components are interactive. If a cell contains an error (e.g., missing phone number), it is highlighted in red. The user can click and edit the cell directly within the staging table. The row is immediately re-validated.

**4. The Commit Phase**
- The main `ImportExportPage.jsx` controls the final commit.
- **Safety Lock**: The `Commit Leads` button is physically disabled if `hasErrors` evaluates to true across the parsed leads array.
- **Batch Processing**: Upon clicking commit, `batchWriteLeads` is invoked. This service uses Firebase's batch operations to write all validated leads atomically to the database, ensuring that either all leads are imported successfully or none are, preventing partial data corruption.
- Displays immediate visual feedback (success banner) upon completion.
