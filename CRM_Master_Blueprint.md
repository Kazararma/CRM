# CRM Application — Master Blueprint for AI Coding Agent

> **AGENT DIRECTIVE:** This document is your single source of truth. Read it in full before writing a single line of code. Complete each phase entirely and verify it before proceeding to the next. Do not skip steps. Do not infer undocumented behaviour — refer back to this document.

---

## Table of Contents

1. [Project Overview & Goals](#1-project-overview--goals)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Manual Developer Interventions (CRITICAL — Do First)](#3-manual-developer-interventions-critical--do-first)
4. [Firestore Database Schema](#4-firestore-database-schema)
5. [Firestore Security Rules](#5-firestore-security-rules)
6. [Application Architecture & State Management](#6-application-architecture--state-management)
7. [Component Tree Structure](#7-component-tree-structure)
8. [Phased Implementation Plan](#8-phased-implementation-plan)

---

## 1. Project Overview & Goals

This is a **web-based Customer Relationship Management (CRM) application** built for internal team use. It manages projects, workers, billing, meeting logs, and work logs under a strict role-based access control (RBAC) system.

### Core Goals

- Provide **Admins** with full visibility into all projects, all workers, and all productivity metrics.
- Provide **Workers** with a scoped, distraction-free view of only the projects they are assigned to.
- Enable structured **project lifecycle management** — from creation through to completion or cancellation — with full audit trails.
- Log every significant action: budget changes, stage transitions, meeting notes, and individual work entries.
- Be fully **mobile-responsive** so users can interact with the CRM from any device.

### Role Summary

| Role        | Capabilities                                                                                   |
|-------------|-----------------------------------------------------------------------------------------------|
| Super Admin | All Admin capabilities + can revoke Admin status from any user                                |
| Admin       | Create/edit projects, assign roles (promote Worker → Admin), full visibility of all sections  |
| Worker      | View Dashboard only, see only assigned projects, add work logs and meeting logs to those projects |

### Sections Summary

| Section   | Visible To         | Purpose                                                          |
|-----------|--------------------|------------------------------------------------------------------|
| People    | Admins only        | View workers as cards, inspect work logs, assign Admin role       |
| Projects  | Admins only        | Create and edit projects, assign workers and admins              |
| Dashboard | Admins & Workers   | Live project cards with logs, stage management, budget tracking  |

---

## 2. Tech Stack & Dependencies

### Frontend

| Package                  | Purpose                                               |
|--------------------------|-------------------------------------------------------|
| `react` + `react-dom`    | UI framework                                          |
| `react-router-dom` v6    | Client-side routing and protected route guards        |
| `tailwindcss`            | Utility-first CSS; drives mobile responsiveness       |
| `@headlessui/react`      | Accessible modals, dropdowns, tabs (unstyled)         |
| `react-hook-form`        | Form state management and validation                  |
| `date-fns`               | Date formatting for logs and timestamps               |
| `lucide-react`           | Icon library                                          |

### Backend / Infrastructure

| Service                         | Purpose                                                      |
|---------------------------------|--------------------------------------------------------------|
| `firebase` (JS SDK v9+ modular) | Auth, Firestore, and app initialisation                      |
| Firebase Authentication         | Google Sign-In as the sole identity provider                 |
| Cloud Firestore                 | NoSQL document database for all application data             |
| Firestore Security Rules        | Server-side enforcement of RBAC — never trust the client     |

### Tooling

| Tool         | Purpose                             |
|--------------|-------------------------------------|
| Vite         | Build tool and dev server           |
| ESLint       | Code linting                        |
| Prettier     | Code formatting                     |
| `.env` file  | Store Firebase config keys securely |

### Installation Command (run after scaffolding the project)

```bash
npm create vite@latest crm-app -- --template react
cd crm-app
npm install firebase react-router-dom @headlessui/react react-hook-form date-fns lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## 3. Manual Developer Interventions (CRITICAL — Do First)

> **⚠️ STOP. THE AI AGENT CANNOT PERFORM THESE STEPS. A HUMAN DEVELOPER MUST COMPLETE ALL OF THE FOLLOWING BEFORE THE AGENT BEGINS CODING. NONE OF THESE CAN BE AUTOMATED. FAILURE TO COMPLETE THESE STEPS WILL CAUSE THE ENTIRE APPLICATION TO FAIL.**

---

### Step 1 — Create a Firebase Project

1. Navigate to [https://console.firebase.google.com](https://console.firebase.google.com).
2. Click **"Add project"** and follow the prompts.
3. Give it a meaningful name (e.g., `crm-internal`).
4. You may disable Google Analytics for a simpler setup unless needed.
5. Wait for the project to be provisioned.

---

### Step 2 — Register a Web App and Retrieve Config Keys

1. Inside the Firebase project dashboard, click the **Web icon (`</>`)** to add a web app.
2. Register the app (give it a nickname, e.g., `crm-web`). Do **not** enable Firebase Hosting unless you plan to use it.
3. After registration, Firebase will display a `firebaseConfig` object. **Copy these values.**
4. Create a `.env` file in the root of the project (same level as `package.json`) and populate it:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
```

5. Add `.env` to `.gitignore` immediately. **Never commit this file to version control.**

---

### Step 3 — Enable Google Sign-In in Firebase Authentication

1. In the Firebase console, navigate to **Authentication → Sign-in method**.
2. Click **Google** under the "Native providers" list.
3. Toggle the **Enable** switch to ON.
4. Select your project's support email from the dropdown.
5. Click **Save**.

---

### Step 4 — Initialise Cloud Firestore

1. In the Firebase console, navigate to **Firestore Database**.
2. Click **"Create database"**.
3. Select **"Start in production mode"** — the AI agent will deploy the correct security rules in Phase 1. Do NOT use test mode as it grants open access.
4. Choose the Firestore location closest to your primary user base (this cannot be changed later). Recommended: `us-central` or the nearest regional option.
5. Click **Done** and wait for provisioning.

---

### Step 5 — Bootstrap the First Super Admin Document (CRITICAL FOR RBAC)

> **This is the most critical manual step. Without it, no one will have Super Admin access and the role system will be permanently broken.**

The application's RBAC system is driven by a `users` collection in Firestore. Because there is no user in the system yet, the first Super Admin record must be created **manually** before any login.

**Procedure:**

1. Sign in to the CRM application once using Google Sign-In (this creates the Firebase Auth user and triggers the app's `onAuthStateChanged` listener to create an initial `users` document with `role: "worker"`).
2. Immediately go to the **Firebase Console → Firestore Database**.
3. Navigate to the `users` collection and find the document whose ID matches your Google account's Firebase UID (visible in **Authentication → Users** tab, copy the UID).
4. Click on that document and **manually edit the following fields**:

| Field         | Type    | Value          |
|---------------|---------|----------------|
| `role`        | string  | `super_admin`  |
| `displayName` | string  | Your full name |
| `email`       | string  | Your Gmail     |
| `photoURL`    | string  | Your Google profile picture URL |
| `createdAt`   | timestamp | (set to now) |

5. Save the document.

From this point forward, the application's RBAC logic will recognise this UID as the Super Admin. All future role assignments are managed through the application's UI.

---

### Step 6 — Deploy Firestore Security Rules

1. After the AI agent generates the security rules file (see Section 5), the developer must deploy them:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # select the correct project
firebase deploy --only firestore:rules
```

Alternatively, paste the rules directly into **Firestore → Rules** tab in the Firebase console and click **Publish**.

---

## 4. Firestore Database Schema

> **AGENT DIRECTIVE:** Use the exact field names, types, and collection paths defined below. Do not rename fields or restructure collections without updating every reference across the codebase.

---

### Collection: `users`

**Path:** `/users/{userId}`
**Document ID:** Firebase Auth UID (auto-set on first login)

| Field         | Type      | Description                                                       |
|---------------|-----------|-------------------------------------------------------------------|
| `uid`         | `string`  | Firebase Auth UID (mirrors the document ID)                       |
| `email`       | `string`  | User's Google email address                                       |
| `displayName` | `string`  | Full name from Google profile                                     |
| `photoURL`    | `string`  | Profile picture URL from Google                                   |
| `role`        | `string`  | One of: `"super_admin"`, `"admin"`, `"worker"`                   |
| `createdAt`   | `timestamp` | Server timestamp set on first document creation               |

**Notes:**
- This document is created automatically on the user's first login if it does not already exist. Default `role` on auto-creation must be `"worker"`.
- Role escalation to `admin` is performed by Admins. Role de-escalation is performed by Super Admin only.

---

### Collection: `projects`

**Path:** `/projects/{projectId}`
**Document ID:** Auto-generated by Firestore

| Field            | Type        | Description                                                                 |
|------------------|-------------|-----------------------------------------------------------------------------|
| `title`          | `string`    | Project title                                                               |
| `notes`          | `string`    | General project notes/description                                           |
| `status`         | `string`    | One of: `"ongoing"`, `"completed"`, `"cancelled"`. Defaults to `"ongoing"` |
| `totalBilling`   | `number`    | Total contract value (amount agreed with client)                            |
| `amountPaid`     | `number`    | Amount paid so far by the client                                            |
| `assignedWorkers`| `array<string>` | Array of Firebase UIDs of assigned workers                             |
| `assignedAdmins` | `array<string>` | Array of Firebase UIDs of assigned admins                              |
| `createdBy`      | `string`    | UID of the admin who created the project                                    |
| `createdAt`      | `timestamp` | Server timestamp of creation                                                |
| `updatedAt`      | `timestamp` | Server timestamp of last update                                             |

---

### Subcollection: `projects/{projectId}/workLogs`

**Path:** `/projects/{projectId}/workLogs/{logId}`
**Document ID:** Auto-generated

| Field         | Type        | Description                                            |
|---------------|-------------|--------------------------------------------------------|
| `heading`     | `string`    | Short title for the work log entry                     |
| `description` | `string`    | Detailed description of the work done                  |
| `authorUid`   | `string`    | UID of the user who created the log                    |
| `authorName`  | `string`    | Display name of the author (denormalised for display)  |
| `authorRole`  | `string`    | Role of the author at time of logging                  |
| `createdAt`   | `timestamp` | Server timestamp                                       |

---

### Subcollection: `projects/{projectId}/meetingLogs`

**Path:** `/projects/{projectId}/meetingLogs/{logId}`
**Document ID:** Auto-generated

| Field         | Type        | Description                                              |
|---------------|-------------|----------------------------------------------------------|
| `date`        | `string`    | Date of the meeting (ISO 8601: `YYYY-MM-DD`)             |
| `time`        | `string`    | Time of the meeting (24hr format: `HH:MM`)               |
| `mode`        | `string`    | One of: `"in-person"`, `"video-call"`, `"phone-call"`   |
| `topic`       | `string`    | Subject/agenda of the meeting                            |
| `minutes`     | `string`    | Full minutes / notes from the meeting                    |
| `loggedBy`    | `string`    | UID of the user who created this log                     |
| `loggedByName`| `string`    | Display name (denormalised)                              |
| `createdAt`   | `timestamp` | Server timestamp                                         |

---

### Subcollection: `projects/{projectId}/budgetLogs`

**Path:** `/projects/{projectId}/budgetLogs/{logId}`
**Document ID:** Auto-generated

| Field          | Type        | Description                                                        |
|----------------|-------------|--------------------------------------------------------------------|
| `changedBy`    | `string`    | UID of the user who made the budget change                         |
| `changedByName`| `string`    | Display name (denormalised)                                        |
| `fieldChanged` | `string`    | Either `"totalBilling"` or `"amountPaid"`                         |
| `previousValue`| `number`    | The value before the change                                        |
| `newValue`     | `number`    | The value after the change                                         |
| `createdAt`    | `timestamp` | Server timestamp                                                   |

---

### Subcollection: `projects/{projectId}/stageChangeLogs`

**Path:** `/projects/{projectId}/stageChangeLogs/{logId}`
**Document ID:** Auto-generated

| Field          | Type        | Description                                    |
|----------------|-------------|------------------------------------------------|
| `changedBy`    | `string`    | UID of the user who changed the stage          |
| `changedByName`| `string`    | Display name (denormalised)                    |
| `previousStatus`| `string`  | Previous status value                          |
| `newStatus`    | `string`    | New status value                               |
| `createdAt`    | `timestamp` | Server timestamp                               |

---

## 5. Firestore Security Rules

> **AGENT DIRECTIVE:** Implement these rules exactly as specified in `firestore.rules`. Deploy them before any other write operations. These rules are the authoritative access control layer — never rely solely on frontend conditionals for security.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ─── Helper Functions ───────────────────────────────────────────────

    // Returns true if the requesting user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Retrieves the current user's Firestore document
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    // Role checks — reads from the users collection
    function isSuperAdmin() {
      return isAuthenticated() && getUserData().role == 'super_admin';
    }

    function isAdmin() {
      return isAuthenticated() && (getUserData().role == 'admin' || getUserData().role == 'super_admin');
    }

    function isWorker() {
      return isAuthenticated() && getUserData().role == 'worker';
    }

    // Returns true if the requesting user is assigned to a given project
    function isAssignedToProject(projectId) {
      let project = get(/databases/$(database)/documents/projects/$(projectId)).data;
      return request.auth.uid in project.assignedWorkers || request.auth.uid in project.assignedAdmins;
    }

    // ─── users Collection ────────────────────────────────────────────────

    match /users/{userId} {
      // Any authenticated user can read their own document
      // Admins can read all user documents (for People section)
      allow read: if isAuthenticated() && (request.auth.uid == userId || isAdmin());

      // Users can create their own document on first login only
      allow create: if isAuthenticated() && request.auth.uid == userId
                    && request.resource.data.role == 'worker';

      // Role update rules:
      // Super Admin can update any user's role (including demoting admins)
      // Admins can only promote workers to admin (not demote, not touch super_admin)
      // Users can update their own non-role fields (displayName, photoURL)
      allow update: if isAuthenticated() && (
        // Super Admin can change anything
        isSuperAdmin()
        ||
        // Admin can only promote worker → admin; cannot touch super_admin accounts
        (isAdmin()
          && userId != request.auth.uid
          && getUserData().role != 'super_admin'
          && resource.data.role != 'super_admin'
          && request.resource.data.role == 'admin'
          && resource.data.role == 'worker')
        ||
        // User updating only their own non-role profile fields
        (request.auth.uid == userId
          && request.resource.data.role == resource.data.role)
      );

      // No one can delete user documents through the client
      allow delete: if false;
    }

    // ─── projects Collection ─────────────────────────────────────────────

    match /projects/{projectId} {
      // Admins can read all projects
      // Workers can only read projects they are assigned to
      allow read: if isAdmin()
                  || (isAuthenticated() && isAssignedToProject(projectId));

      // Only admins can create projects
      allow create: if isAdmin();

      // Admins can update any project
      // Assigned workers and assigned admins can update the project
      // (budget, status changes are handled by subcollection logs separately)
      allow update: if isAdmin()
                    || (isAuthenticated() && isAssignedToProject(projectId));

      // Only admins can delete projects
      allow delete: if isAdmin();

      // ─── workLogs Subcollection ─────────────────────────────────────

      match /workLogs/{logId} {
        allow read: if isAdmin() || (isAuthenticated() && isAssignedToProject(projectId));
        allow create: if isAuthenticated()
                      && (isAdmin() || isAssignedToProject(projectId))
                      && request.resource.data.authorUid == request.auth.uid;
        allow update, delete: if false; // Logs are immutable
      }

      // ─── meetingLogs Subcollection ──────────────────────────────────

      match /meetingLogs/{logId} {
        allow read: if isAdmin() || (isAuthenticated() && isAssignedToProject(projectId));
        allow create: if isAuthenticated()
                      && (isAdmin() || isAssignedToProject(projectId))
                      && request.resource.data.loggedBy == request.auth.uid;
        allow update, delete: if false; // Logs are immutable
      }

      // ─── budgetLogs Subcollection ───────────────────────────────────

      match /budgetLogs/{logId} {
        allow read: if isAdmin() || (isAuthenticated() && isAssignedToProject(projectId));
        allow create: if isAuthenticated()
                      && (isAdmin() || isAssignedToProject(projectId))
                      && request.resource.data.changedBy == request.auth.uid;
        allow update, delete: if false; // Logs are immutable
      }

      // ─── stageChangeLogs Subcollection ─────────────────────────────

      match /stageChangeLogs/{logId} {
        allow read: if isAdmin() || (isAuthenticated() && isAssignedToProject(projectId));
        allow create: if isAuthenticated()
                      && (isAdmin() || isAssignedToProject(projectId))
                      && request.resource.data.changedBy == request.auth.uid;
        allow update, delete: if false; // Logs are immutable
      }
    }
  }
}
```

---

## 6. Application Architecture & State Management

### Firebase Initialisation

Create `src/firebase/config.js`. This file initialises the Firebase app using environment variables and exports `auth` and `db` (Firestore) instances. All other files import from here — never initialise Firebase more than once.

```
src/firebase/
  config.js         ← Firebase app init, exports { auth, db }
  authService.js    ← signInWithGoogle(), signOut(), onAuthStateChanged wrapper
  userService.js    ← Firestore CRUD for users collection
  projectService.js ← Firestore CRUD for projects and all subcollections
```

### Authentication & Role State — React Context

Create a single `AuthContext` that wraps the entire application tree. This context is responsible for:

1. Subscribing to Firebase's `onAuthStateChanged` listener on mount.
2. When a user signs in, immediately fetching (or creating) their Firestore `users` document.
3. Exposing `{ currentUser, userProfile, role, loading }` to all components.
4. Providing a `signIn()` and `signOut()` method.

**Context Shape:**

```js
{
  currentUser: FirebaseUser | null,  // raw Firebase Auth object
  userProfile: UserDocument | null,  // Firestore users/{uid} document data
  role: "super_admin" | "admin" | "worker" | null,
  loading: boolean,                  // true while auth state is being resolved
  signIn: () => Promise<void>,       // triggers Google popup sign-in
  signOut: () => Promise<void>,
}
```

**First-Login Logic (inside AuthContext):**
When `onAuthStateChanged` fires with a non-null user, check if a Firestore document exists at `users/{uid}`. If it does not exist, create it with `role: "worker"` and the profile data from the Google Auth object. If it does exist, read it and populate `userProfile`.

### Routing Architecture

Use React Router v6. All routes except `/login` are protected by a `<ProtectedRoute>` component that checks `loading` and `currentUser` from `AuthContext`.

Role-specific routes use a `<RoleGuard>` component that checks `role` from `AuthContext` and redirects non-authorised users to `/dashboard`.

```
/login              → LoginPage (public)
/dashboard          → DashboardPage (all authenticated users)
/projects           → ProjectsPage (admin + super_admin only)
/people             → PeoplePage (admin + super_admin only)
*                   → Redirect to /dashboard
```

### State Management Philosophy

- **No Redux or Zustand required.** React Context + `useState`/`useReducer` + direct Firestore `onSnapshot` listeners are sufficient.
- Use **real-time Firestore listeners** (`onSnapshot`) for the Dashboard so project status changes are reflected instantly across sessions.
- Use **one-time reads** (`getDocs`) for the People and Projects sections where real-time sync is less critical.
- Co-locate data fetching inside custom hooks (`useProjects`, `useUsers`, `useProjectLogs`) rather than in components directly.

---

## 7. Component Tree Structure

> **AGENT DIRECTIVE:** Build components in the order they are listed within each phase. Follow the hierarchy — parent components should be built before the children they render.

```
App
├── AuthProvider                     (Context wrapper — wraps entire app)
│   └── Router
│       ├── ProtectedRoute           (Redirects to /login if no currentUser)
│       │   ├── AppShell             (Main layout: sidebar/nav + content area)
│       │   │   ├── Sidebar          (Navigation links, user avatar, sign-out)
│       │   │   ├── TopBar           (Mobile hamburger menu, user info)
│       │   │   │
│       │   │   ├── PeoplePage       [Admin only]
│       │   │   │   ├── WorkerCard   (Clickable card showing worker summary)
│       │   │   │   └── WorkerDetailModal
│       │   │   │       ├── WorkerInfo         (Name, email, role, photo)
│       │   │   │       ├── AssignAdminButton  (Visible to Admin/SuperAdmin)
│       │   │   │       ├── RevokeAdminButton  (Visible to SuperAdmin only)
│       │   │   │       └── WorkerWorkLogList  (All work logs for this worker)
│       │   │   │
│       │   │   ├── ProjectsPage     [Admin only]
│       │   │   │   ├── CreateProjectForm
│       │   │   │   │   ├── ProjectTitleInput
│       │   │   │   │   ├── ProjectNotesTextarea
│       │   │   │   │   ├── BillingInputGroup  (totalBilling, amountPaid)
│       │   │   │   │   └── AssignmentSelector (multi-select workers + admins)
│       │   │   │   └── ProjectAdminCard       (Expandable card for each project)
│       │   │   │       └── ProjectEditForm    (Same fields as create, pre-filled)
│       │   │   │
│       │   │   └── DashboardPage    [All users]
│       │   │       ├── StatusTabs   (Ongoing / Completed / Cancelled)
│       │   │       └── ProjectDashboardCard  (Per project)
│       │   │           ├── BudgetSection
│       │   │           │   ├── BudgetDisplay
│       │   │           │   ├── BudgetEditForm   (Logs change on submit)
│       │   │           │   └── BudgetLogList    (Immutable audit trail)
│       │   │           ├── StageSelector        (Dropdown)
│       │   │           │   └── StageChangeConfirmModal
│       │   │           ├── WorkLogSection
│       │   │           │   ├── WorkLogList
│       │   │           │   └── AddWorkLogForm
│       │   │           └── MeetingLogSection
│       │   │               ├── MeetingLogList
│       │   │               └── AddMeetingLogForm
│       │   │                   ├── DateInput
│       │   │                   ├── TimeInput
│       │   │                   ├── ModeSelector (in-person/video/phone)
│       │   │                   ├── TopicInput
│       │   │                   └── MinutesTextarea
│       │   │
│       │   └── RoleGuard            (Redirects workers away from /people and /projects)
│       │
│       └── LoginPage                (Public — Google Sign-In button only)
│
└── Shared / UI Components
    ├── LoadingSpinner
    ├── ConfirmModal              (Reusable — used for stage change confirmation)
    ├── EmptyState                (Placeholder when list is empty)
    ├── Badge                    (Role badge: Super Admin / Admin / Worker)
    ├── Avatar                   (User photo with fallback initials)
    └── ErrorBoundary
```

---

## 8. Phased Implementation Plan

> **AGENT DIRECTIVE:**
> - Complete **every task** in a phase before starting the next.
> - After each phase, **verify the application runs without errors** before continuing.
> - Do not leave placeholder `TODO` comments — implement fully or note a known limitation explicitly.
> - All file paths are relative to the project root.

---

### Phase 1 — Firebase Setup, Auth, and Initial Routing

**Goal:** The application can start, authenticate a user via Google, and display role-appropriate UI skeletons.

**Tasks:**

1. Scaffold the Vite + React project and install all dependencies listed in Section 2.
2. Configure Tailwind CSS: update `tailwind.config.js` to scan `./src/**/*.{js,jsx}` and add the Tailwind directives to `src/index.css`.
3. Create `src/firebase/config.js`:
   - Import `initializeApp` from `firebase/app`.
   - Import `getAuth` from `firebase/auth`.
   - Import `getFirestore` from `firebase/firestore`.
   - Read all config values from `import.meta.env.VITE_FIREBASE_*`.
   - Export `app`, `auth`, and `db`.
4. Create `src/firebase/authService.js`:
   - Implement `signInWithGoogle()` using `signInWithPopup` and `GoogleAuthProvider`.
   - Implement `signOutUser()`.
5. Create `src/firebase/userService.js`:
   - Implement `getUserDocument(uid)` — fetches `/users/{uid}`.
   - Implement `createUserDocument(uid, data)` — creates with `role: "worker"`.
   - Implement `updateUserRole(uid, newRole)` — updates only the `role` field.
6. Create `src/context/AuthContext.jsx`:
   - Implement the full context as specified in Section 6.
   - Handle first-login user document creation.
   - Expose `{ currentUser, userProfile, role, loading, signIn, signOut }`.
7. Create `src/components/routing/ProtectedRoute.jsx` — redirects to `/login` if `!currentUser && !loading`.
8. Create `src/components/routing/RoleGuard.jsx` — accepts an `allowedRoles` prop (array of strings); redirects to `/dashboard` if `role` is not in the allowed list.
9. Create `src/pages/LoginPage.jsx` — centred card with app name, tagline, and Google Sign-In button. Redirects to `/dashboard` if already authenticated.
10. Set up `src/App.jsx` with React Router v6 routes as described in Section 6. Wrap everything in `<AuthProvider>`.
11. Create empty placeholder page components: `DashboardPage.jsx`, `ProjectsPage.jsx`, `PeoplePage.jsx`.
12. Create `src/components/layout/AppShell.jsx` — renders `<Sidebar>` and a main content area. Sidebar shows navigation links (only show People and Projects links to admins). Include a sign-out button. Mobile: sidebar collapses to a top navigation bar with hamburger menu.

**Verification Checkpoint:**
- App loads at `/login`.
- Clicking "Sign in with Google" authenticates and redirects to `/dashboard`.
- Visiting `/people` or `/projects` as a worker redirects to `/dashboard`.
- Console shows no Firebase config errors.

---

### Phase 2 — Firestore Security Rules and Data Services

**Goal:** Security rules are deployed; all Firestore read/write operations are implemented as reusable service functions.

**Tasks:**

1. Create `firestore.rules` in the project root with the exact rules from Section 5.
2. Create `firebase.json` in the project root with the Firestore rules path configured (required for deployment).
3. Create `src/firebase/projectService.js` with the following functions:
   - `createProject(data)` — adds document to `projects` collection with `createdAt` and `updatedAt` server timestamps.
   - `getAllProjects()` — fetches all projects (used by admins).
   - `getAssignedProjects(uid)` — queries projects where `assignedWorkers` array contains `uid`.
   - `updateProject(projectId, data)` — updates project fields and sets `updatedAt`.
   - `subscribeToProjects(callback, uid, isAdmin)` — `onSnapshot` listener; returns all projects for admins, assigned-only for workers.
   - `addWorkLog(projectId, logData)` — adds to `workLogs` subcollection.
   - `addMeetingLog(projectId, logData)` — adds to `meetingLogs` subcollection.
   - `addBudgetLog(projectId, logData)` — adds to `budgetLogs` subcollection.
   - `addStageChangeLog(projectId, logData)` — adds to `stageChangeLogs` subcollection.
   - `getWorkLogs(projectId)` — fetches all workLogs for a project, ordered by `createdAt` descending.
   - `getMeetingLogs(projectId)` — fetches all meetingLogs, ordered by `createdAt` descending.
   - `getBudgetLogs(projectId)` — fetches all budgetLogs, ordered by `createdAt` descending.
4. Create `src/firebase/userService.js` additions:
   - `getAllUsers()` — fetches all documents in `users` collection (admin only).
   - `getWorkLogsByUser(uid)` — queries all `workLogs` subcollections across projects for entries where `authorUid == uid`. Use a Firestore Collection Group query on `workLogs`.
5. Enable Firestore Collection Group query support: add a composite index for the `workLogs` collection group on `authorUid` (ascending) and `createdAt` (descending). Document this index in `firestore.indexes.json`.
6. Create custom React hooks in `src/hooks/`:
   - `useAuth()` — shorthand to consume `AuthContext`.
   - `useProjects()` — wraps `subscribeToProjects` with `useEffect`/`useState`, returns `{ projects, loading, error }`.
   - `useProjectLogs(projectId)` — fetches all four log subcollections for a project.
   - `useUsers()` — fetches all users (admin only).

**Verification Checkpoint:**
- Security rules deployed (Firebase console confirms active rules).
- Console log confirms `getAllProjects()` returns data for an admin user.
- Console log confirms `getAssignedProjects(uid)` returns only assigned projects for a worker UID.
- Attempting to write a `workLog` with a mismatched `authorUid` is rejected by Firestore.

---

### Phase 3 — People and Projects Sections (Admin UI)

**Goal:** Admins can view all workers, inspect their work logs, assign/revoke roles, and create/edit projects.

**Tasks:**

1. Build `src/pages/PeoplePage.jsx`:
   - Uses `useUsers()` to load all users.
   - Renders a responsive grid of `<WorkerCard>` components.
   - Includes a search/filter input to filter workers by name.
2. Build `src/components/people/WorkerCard.jsx`:
   - Displays: avatar (`<Avatar>`), display name, email, role badge (`<Badge>`).
   - On click, opens `<WorkerDetailModal>`.
3. Build `src/components/people/WorkerDetailModal.jsx`:
   - Shows full worker profile.
   - Shows a list of all their work logs (fetched via `getWorkLogsByUser(uid)`), grouped by project name.
   - **Assign Admin Button:** Visible to all admins if worker's role is `"worker"`. On click, calls `updateUserRole(uid, "admin")`.
   - **Revoke Admin Button:** Visible only when `role === "super_admin"` (in `AuthContext`) and the target user's role is `"admin"`. On click, calls `updateUserRole(uid, "worker")`.
   - Both role change actions require a `<ConfirmModal>` before executing.
4. Build `src/pages/ProjectsPage.jsx`:
   - Renders `<CreateProjectForm>` at the top.
   - Below it, renders a list of `<ProjectAdminCard>` for all existing projects.
5. Build `src/components/projects/CreateProjectForm.jsx`:
   - Fields: Title (required), Notes (textarea), Total Billing (number), Amount Paid (number), Assign Workers (multi-select dropdown of all users with `role === "worker"`), Assign Admins (multi-select dropdown of all users with `role === "admin"` or `"super_admin"`).
   - On submit, calls `createProject(data)` with `status: "ongoing"` and server timestamps.
   - Uses `react-hook-form` for validation.
   - Shows success toast / inline message on completion; resets form.
6. Build `src/components/projects/ProjectAdminCard.jsx`:
   - Shows project title, status badge, assigned members count.
   - Clicking expands the card to show `<ProjectEditForm>`.
7. Build `src/components/projects/ProjectEditForm.jsx`:
   - Same fields as `<CreateProjectForm>` but pre-populated with current project data.
   - On submit, calls `updateProject(projectId, data)`.

**Verification Checkpoint:**
- Admin can see all workers in the People section.
- Clicking a worker opens the modal with their work log.
- Admin can promote a worker to admin; Super Admin can demote an admin.
- Admin can create a new project; it appears in the project list.
- Admin can expand a project card and edit its details.

---

### Phase 4 — Dashboard Section (All Users)

**Goal:** All authenticated users can view the Dashboard; workers see only their assigned projects; all project interactions (stage changes, budget edits, log additions) work correctly with full audit trails.

**Tasks:**

1. Build `src/pages/DashboardPage.jsx`:
   - Uses `useProjects()` (which uses `subscribeToProjects` — real-time listener).
   - Renders `<StatusTabs>` with tabs: **Ongoing**, **Completed**, **Cancelled**.
   - Each tab filters `projects` by `status` field and renders `<ProjectDashboardCard>` for each.
2. Build `src/components/dashboard/StatusTabs.jsx`:
   - Uses `@headlessui/react` `Tab` components for accessible tab switching.
   - Shows a count badge on each tab.
3. Build `src/components/dashboard/ProjectDashboardCard.jsx`:
   - Collapsed state: shows project title, status badge, assigned members avatars.
   - Expanded state (on click): renders all four sub-sections below.
4. Build `src/components/dashboard/BudgetSection.jsx`:
   - Displays `amountPaid` / `totalBilling` as a progress-style display.
   - **Edit:** Clicking an edit icon opens `<BudgetEditForm>`. On submit:
     1. Creates a `budgetLog` entry via `addBudgetLog()` capturing old value, new value, and the current user.
     2. Calls `updateProject()` to persist the new value.
   - Renders `<BudgetLogList>` below — an immutable, timestamped list of all budget changes.
5. Build `src/components/dashboard/StageSelector.jsx`:
   - A styled `<select>` dropdown with options: `ongoing`, `completed`, `cancelled`.
   - On change (before applying):
     1. Opens `<StageChangeConfirmModal>` showing the requested transition.
     2. On confirm: calls `updateProject(projectId, { status: newStatus })` and `addStageChangeLog()`.
     3. On cancel: reverts the dropdown display to the current status.
6. Build `src/components/shared/ConfirmModal.jsx` (reusable):
   - Props: `isOpen`, `onConfirm`, `onCancel`, `title`, `message`.
   - Uses `@headlessui/react` `Dialog` for accessible modal behaviour.
   - Trap focus inside the modal.
7. Build `src/components/dashboard/WorkLogSection.jsx`:
   - Fetches and displays work logs from `workLogs` subcollection via `useProjectLogs`.
   - Each log shows: heading, description, author name + avatar, timestamp.
   - `<AddWorkLogForm>`: fields for `heading` and `description`; on submit, calls `addWorkLog()` with `authorUid` = current user's UID.
8. Build `src/components/dashboard/MeetingLogSection.jsx`:
   - Fetches and displays meeting logs.
   - Each log shows: date, time, mode badge, topic, minutes (expandable), logged by.
   - `<AddMeetingLogForm>`: fields for date, time, mode (select), topic, minutes; on submit, calls `addMeetingLog()`.

**Verification Checkpoint:**
- Worker sees only their assigned projects in the Dashboard.
- Changing a project stage shows the confirmation modal; confirming moves the card to the correct tab.
- Adding a work log appears immediately (real-time listener) and logs the correct author.
- Editing the budget creates a visible audit log entry.
- Worker cannot see the People or Projects navigation links.

---

### Phase 5 — Polish, Responsiveness, and Error Handling

**Goal:** The application is production-ready, fully mobile-responsive, handles edge cases gracefully, and provides a consistent user experience.

**Tasks:**

1. **Mobile Responsiveness Audit:**
   - `AppShell`: On screens `< md` breakpoint, sidebar is hidden behind a hamburger menu (`TopBar`). Use Tailwind's `md:` prefix throughout. The sidebar should slide in as an overlay on mobile.
   - All card grids: use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
   - All modals: use `max-w-full mx-4` on mobile, `max-w-lg mx-auto` on desktop.
   - All forms: inputs should be full-width on mobile.
   - The Dashboard tabs should scroll horizontally on narrow screens without breaking layout.

2. **Loading States:**
   - All data-fetching operations must display a `<LoadingSpinner>` while `loading === true`.
   - The initial auth check in `AuthContext` must show a full-page loading screen until `loading === false` to prevent route flicker.

3. **Empty States:**
   - If a tab in the Dashboard has no projects, render `<EmptyState>` with an appropriate message (e.g., "No ongoing projects.").
   - If the People section has no workers, render `<EmptyState>`.

4. **Error Handling:**
   - Wrap all Firestore service calls in try/catch.
   - Display user-friendly error messages (not raw Firebase error codes) via an inline error component.
   - Add an `<ErrorBoundary>` at the `AppShell` level to catch unexpected render errors.

5. **Shared UI Components — Final Pass:**
   - `<Badge>`: colour-coded by role (`super_admin` = purple, `admin` = blue, `worker` = grey) and by status (`ongoing` = yellow, `completed` = green, `cancelled` = red).
   - `<Avatar>`: shows `photoURL` if available, otherwise renders a circle with the user's initials, background colour derived from the user's name hash.
   - `<LoadingSpinner>`: centred SVG spinner.

6. **Security Final Audit:**
   - Confirm that all navigation links to admin-only pages are hidden in the UI for workers.
   - Confirm that `<RoleGuard>` still server-side-protects routes even if a worker manually types `/people` or `/projects` in the URL bar.
   - Confirm that Firestore security rules (not just UI guards) reject unauthorised reads and writes.

7. **Environment & Build:**
   - Confirm `.env` is in `.gitignore`.
   - Run `npm run build` and verify the build completes without errors.
   - Test the production build locally with `npm run preview`.

8. **Final Firestore Index Deployment:**
   - Deploy `firestore.indexes.json` to ensure Collection Group queries on `workLogs` function correctly.

**Verification Checkpoint (Final):**
- Application is fully usable on a 375px mobile screen.
- No console errors or warnings in either development or production build.
- A worker account: can sign in, sees only Dashboard, sees only assigned projects, can add work and meeting logs.
- An admin account: sees all three sections, can create projects, promote workers, edit all project fields.
- A Super Admin account: can additionally demote admins to workers.
- All log entries (work, meeting, budget, stage change) are immutable — no edit or delete options appear.
- Budget changes are visibly attributed to the user who made them, with timestamps.
- Stage changes require confirmation and are immediately reflected in the correct Dashboard tab.
```

---

*End of Master Blueprint. The AI coding agent must not proceed beyond this document. All architectural decisions have been made. Implement exactly as specified.*
