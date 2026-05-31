# CRM Project Detailed Summary

## 1. Project Overview & Functions
The CRM project is a real-time, enterprise-grade business management platform that bridges client acquisition, project execution, worker productivity, and automated payroll. 

### Core Modules:
- **Acquisition Pipeline**: 3-stage CRM pipeline (Lead ➔ Opportunity ➔ Project) with a 10-stage opportunity funnel and legacy-safe leads normalizer. Uses atomic handshakes for data safety.
- **Labor & Shift Tracking**: Features a global shift timer, anti-idle heartbeats, and admin shift validation.
- **Smart Salary Engine**: Tri-factor compensation handling project-based, monthly, and hourly payrolls along with a transparent payment handshake loop.

## 2. Tech Stack & Architecture
- **Frontend**: 
  - React 18 (Vite SPA)
  - React Router v6 (Role-Based Access Control)
  - Tailwind CSS (Utility-first styling)
  - Headless UI (Accessible components)
  - Lucide React (Icons)
  - React Hook Form (Validation)
- **Backend**: 
  - Firebase Firestore (NoSQL, real-time `onSnapshot` listeners)
  - Firebase Authentication (Google Sign-In mapped to roles)
  - Firestore Security Rules (`super_admin`, `admin`, `worker` RBAC)

---

## 3. Deep Dive: Worklog Feature & Workhour Section

### Worklog Feature Structure
The Worklog feature resides in the **Right Column** of the expanded Project Dashboard Cards (`WorkLogSection.jsx`). It is a chronological feed of all tasks completed for a specific project.
- **Display**: Shows worker avatar, name, timestamp, task heading, and a detailed description.
- **Form Inputs**: Workers use a simple form (via `react-hook-form`) providing a **Heading** (e.g., "UI Fixes") and **Description** (what was worked on).

### Worklog Validation & Update Mechanism
The platform uses an innovative **Auto-Validation Mechanism** tied directly to the Worklog submission.
- **Submission**: When a worker submits a work log via `addWorkLog`, the data is saved with their UID, name, role, and the current `associatedShiftId`.
- **Auto-Validation Hook**: If an active shift is detected (`associatedShiftId`), the system queries the exact shift document in Firestore and triggers an `updateDoc`.
- **Payload Updates**: The active shift is immediately updated with:
  - `isValidated: true`
  - `projectId`: Syncs the project ID
  - `taskHeading` & `taskDescription`: Copies the log data directly into the shift payload.
  - `validationMethod: "auto_work_log"`
- **Admins** can still view and manually validate/deny these shifts in the "Awaiting Validation" section on the left column of the project dashboard.

### Workhours Section (`WorkHourSection.jsx`)
The Workhours section acts as a centralized hub for tracking and reviewing hours.
- **Role-Based Views**:
  - **Admin View (`WorkHourAdminView`)**: Admins can monitor organizational efficiency, validate logs, and review team overviews. They have a toggle between `TEAM OVERVIEW` and `MY HOURS`.
  - **Worker View (`WorkHourWorkerView`)**: Workers can only review their active shifts, logged hours, and validation statuses.

---

## 4. Deep Dive: Shift Timer and Its Working

The **Floating Shift Timer** (`FloatingShiftTimer.jsx` and `ShiftContext.jsx`) is a robust, persistent clock system designed to track active worker minutes, prevent "ghost hours", and cleanly sync with Firestore.

### Key Characteristics:
- **Persistent & Draggable UI**: The timer is a fixed overlay that follows the user across the application. It saves its X/Y coordinates to `localStorage`.
- **Theme States**:
  - **Active (Blue)**: Shift is running smoothly.
  - **Heartbeat Required (Amber Pulse)**: The user has been idle and must confirm they are still working.
  - **Offline (White)**: No active shift.

### Internal Working & Heartbeat Mechanism:
1. **Starting a Shift**: Workers select a project from a dropdown and hit "Start". This creates a new shift payload in Firestore with `status: "active"` and `isValidated: false`.
2. **The Timer Loop**: An interval ticks every 1 second to update the UI `elapsedSeconds` without heavy re-renders. 
3. **Anti-Idle Heartbeat**: 
   - The system constantly compares the current time against the `lastHeartbeat`.
   - If the time exceeds the `HEARTBEAT_INTERVAL_MS`, the timer turns amber, and the user enters a `HEARTBEAT_GRACE_PERIOD_MS`.
   - The user must interact to trigger `confirmHeartbeat()`, which updates `lastHeartbeat` in Firestore to the current server timestamp.
4. **Auto-Expiration**: If the worker fails to confirm the heartbeat within the grace period, `expireShift()` is called. The shift is automatically ended and its duration is capped to the last confirmed heartbeat plus the grace period.

### Ghost Shift Cleanup (The "Nuke Active" Rule):
The `ShiftContext` runs a reconciliation effect on mount. If a worker leaves the tab open or the app crashes, the system cleans up stale shifts:
- Queries all `"active"` shifts for the user.
- **Triggers Expiration if**:
  - The shift started on a previous calendar day.
  - The shift is > 24 hours old.
  - There are multiple active shifts (it keeps only the newest one and nukes the rest).
- It safely estimates the duration based on `lastHeartbeat` + 1 minute to ensure the worker isn't heavily penalized but the system isn't cheated.

### Strict Payroll Enforcement:
Workers are met with a strict "PAYROLL NOTICE" informing them:
- To log hours, they MUST update a "Work Log" (which triggers the auto-validation).
- To switch projects, they must submit the current log, **End the Current Shift**, select the new project, and start a new shift. Project switching during an active shift is strictly prevented to maintain clean accounting.
