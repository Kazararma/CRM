# CRM Product Review & Specifications

## 1. Product Overview
CRM (formerly Nexus CRM) is a comprehensive, web-based Customer Relationship Management system designed for internal team management. It streamlines project lifecycles, sales pipelines, and team productivity within a single, cohesive platform.

The application prioritizes data integrity through a strict Role-Based Access Control (RBAC) system and provides real-time visibility into project health, financial metrics, and worker contributions.

## 2. Target Users & Roles
The system identifies three primary user roles, each with specific access levels and responsibilities:

| Role | Capabilities |
| :--- | :--- |
| **Super Admin** | Full system access. Can manage all projects, workers, and financial data. Exclusive ability to promote or demote Admin users. |
| **Admin** | Full visibility into all sections. Can create/edit projects, assign workers, and promote Workers to Admins. |
| **Worker** | Scoped access. Can only view assigned projects, log work hours, and record meeting notes. Restricted from People and Projects management sections. |

## 3. Core Features & Functionality

### 3.1 Project Lifecycle Management
CRM tracks projects from inception to final payment. Key features include:
*   **Dynamic Status Tracking:** Projects transition through 'Ongoing', 'Completed', 'Cancelled', and 'Client Paid' stages.
*   **Assignment System:** Multi-select workers and admins can be assigned to specific projects.
*   **Real-time Dashboard:** Project cards reflect live status updates, budget progress, and recent activity logs.
*   **Auto-Status Updates:** System automatically marks projects as 'Client Paid' when the budget is fully met.

### 3.2 Sales Pipeline (Kanban)
A visual Kanban board facilitates deal management through several stages: Lead, Discovery, Negotiation, Won, Lost, Client Paid.

Specialized features for the pipeline include:
*   **Negotiation Enhancements:** Direct editing of deal value and requirements during the negotiation phase.
*   **Visual Feedback:** Color-coded cards (Green for Won/Project-linked, Red for Lost) for immediate status recognition.
*   **Conversion Workflow:** Seamlessly convert 'Won' deals into active projects with data carry-over.

### 3.3 Productivity & Audit Logs
Every interaction is recorded in specialized sub-collections for full transparency:
*   **Work Logs:** Detailed descriptions of tasks completed by workers.
*   **Meeting Logs:** Records of date, time, mode (video/phone/in-person), and minutes.
*   **Budget Logs:** Immutable audit trail of every change made to 'Total Billing' or 'Amount Paid'.
*   **Stage Logs:** Tracking of when and by whom a project stage was transitioned.

## 4. Technical Specifications

### 4.1 Technology Stack
*   **Frontend:** React, Vite, Tailwind CSS, Headless UI, React Hook Form, Lucide Icons.
*   **Backend/Auth:** Firebase (Authentication, Cloud Firestore) or Express/Node.js Monorepo.
*   **Database:** Firestore (NoSQL) or PostgreSQL with Prisma ORM.
*   **Authentication:** Google Sign-In (OAuth 2.0).

### 4.2 Security Architecture
The system employs 'Defense in Depth' security:
*   **Firestore Security Rules:** Server-side enforcement of RBAC. Access is denied at the database level even if frontend guards are bypassed.
*   **Role Guards:** React-based routing protection to prevent unauthorized access to Admin pages.
*   **Immutable Logs:** Work logs and audit trails are append-only to prevent tampering.

## 5. Recent Enhancements & Roadmap
*   **Payment Capping:** Prevents overpayment by capping inputs at the remaining budget.
*   **Manual Finance Confirmation:** Adds a safety layer where admins must confirm project payments before they appear in financial reports.
*   **Advanced Search & Filters:** Implementation of global search and pipeline filtering to handle high volumes of data.
*   **Enhanced Client Data:** Expanded capture of company details, including Phone and Address.

## 6. Conclusion
CRM is a robust, scalable solution tailored for modern teams. By combining real-time data sync with rigorous audit logging and a user-centric design, it provides a premium experience for managing both client relationships and internal operations.
