# WAVELET CRM 🌊

> A real-time, enterprise-grade business management platform that seamlessly bridges client acquisition, project execution, automated payroll, and financial invoicing.

Wavelet CRM is a full-stack Single Page Application (SPA) designed to manage the entire lifecycle of a business. It transforms raw leads into actionable projects, tracks employee labor with high-fidelity timers, calculates complex payroll structures in real-time, and generates professional PDF invoices on the fly.

## ✨ Core Features

### 🎯 1. Acquisition Pipeline (Leads & Opportunities)
* **10-Stage Opportunity Funnel:** A dynamic Kanban board tracking deals from *Prospecting* to *Closed Won*.
* **Dynamic Financial Engine:** Auto-calculates margins, agreed budgets, and outstanding balances based on the deal's current phase.
* **Atomic Handshakes:** Zero-data-loss conversions using Firestore batch writes to instantly upgrade a Lead to an Opportunity, and an Opportunity to an active Project.

### 🛠️ 2. Project Execution
* **Live Budget Tracking:** Real-time P&L tracking calculating overhead expenses, labor costs, and realized profit instantly.
* **Role-Based Assignment:** Secure assignment of specific Workers and Admins to isolated project scopes.
* **Audit Trails:** Automated logging for all phase changes and financial updates.

### ⏱️ 3. Labor & Shift Tracking
* **Floating Shift Timer:** A persistent, 60fps global timer allowing workers to log hours against assigned projects without interrupting their workflow.
* **The "Online Heartbeat":** An automated anti-idle system that requests worker confirmation to prevent "ghost hours".
* **Work Hour Dashboard:** A visual calendar for workers to track pending and validated shifts.

### 💰 4. Smart Salary Engine
* **Tri-Factor Compensation:** Native support for Project-based (with overtime logic), Monthly (20-day eligibility check), and Hourly compensation structures.
* **The Payment Handshake:** A secure, two-way confirmation loop (`Initiate Payment` -> `Pending` -> `Salary Received` / `Disputed`) between Admins and Workers.
* **Localization:** Global Indian Rupee (₹) currency formatting.

### 📄 5. Automated PDF Invoicing Engine
* **Dynamic PDF Generation:** Instant client-ready PDF invoice rendering natively in the browser using `@react-pdf/renderer`.
* **Global Configuration:** Centralized control over company identity, banking details, and default signature blocks, dynamically synced to all new invoices.
* **Project Integration:** Seamless one-click invoice generation directly from the Project Management dashboard, auto-filling client details and outstanding balances.
* **Responsive UI:** Fully mobile-optimized interface with scalable layout grids and custom scrollbars.

---

## 💻 Tech Stack

**Frontend:**
* [React 18](https://react.dev/) (via Vite for lightning-fast HMR)
* [Tailwind CSS](https://tailwindcss.com/) (Utility-first styling)
* [Lucide React](https://lucide.dev/) (Scalable SVG iconography)
* [React PDF](https://react-pdf.org/) (Client-side dynamic PDF generation)
* [React Hook Form](https://react-hook-form.com/) (Performant, flexible form validation)

**Backend & Database:**
* [Firebase Firestore](https://firebase.google.com/docs/firestore) (Real-time NoSQL database via `onSnapshot`)
* [Firebase Authentication](https://firebase.google.com/docs/auth) (Role-Based Access Control)

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18 or higher)
* A Firebase account and project.

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Kazarama/CRM.git](https://github.com/Kazarama/CRM.git)
   cd CRM