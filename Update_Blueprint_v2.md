# Update Blueprint v2 — Worklog Attachments & Smart Break System
### Wavelet CRM · React 18 + Vite + Tailwind CSS + Lucide React + Firebase

> **Document Authority:** This blueprint governs two additive feature updates to the existing CRM. All changes are non-destructive — no existing Firestore document fields are removed, no existing component logic is replaced wholesale. Every change is a surgical addition to the working codebase described in `CRM_Project_Summary_Worklog.md`.

---

## Table of Contents
1. [Firebase Storage & Firestore Schema Updates](#1-firebase-storage--firestore-schema-updates)
2. [Worklog Attachment Architecture](#2-worklog-attachment-architecture)
3. [The Smart Break System — ShiftContext Math](#3-the-smart-break-system--shiftcontext-math)
4. [Floating Timer UI Updates](#4-floating-timer-ui-updates)
5. [Admin Break Configuration](#5-admin-break-configuration)
6. [Component & File Change Summary](#6-component--file-change-summary)

---

## 1. Firebase Storage & Firestore Schema Updates

### 1.1 Firebase Storage Path Structure

All worklog attachments are stored under a path that encodes the project, worker, and timestamp — ensuring uniqueness, preventing collisions, and enabling Storage Security Rules to validate the uploader's identity:

```
worklogs/{projectId}/{workerId}/{timestamp}_{originalFilename}
```

**Examples:**
```
worklogs/proj_abc123/user_xyz789/1718000000000_api_integration_proof.pdf
worklogs/proj_abc123/user_xyz789/1718001234567_ui_screenshot.png
```

**Path design rationale:**
- `projectId` at the top level allows Storage rules to cross-validate project assignment.
- `workerId` allows rules to enforce that only the owning worker can upload to their own path.
- `{timestamp}_` prefix guarantees uniqueness even if the same filename is uploaded twice.
- No shared folders — workers cannot list or access each other's upload paths.

---

### 1.2 Firebase Storage Security Rules

Add the following rules to `storage.rules`. These rules enforce file type, file size, and identity constraints at the infrastructure layer — never rely on client-side validation alone.

```js
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // ── Worklog Attachments ─────────────────────────────────────────────────
    match /worklogs/{projectId}/{workerId}/{fileName} {

      // READ: The uploading worker OR any admin/super_admin can read the file.
      allow read: if request.auth != null && (
        request.auth.uid == workerId ||
        firestore.get(
          /databases/(default)/documents/users/$(request.auth.uid)
        ).data.role in ['admin', 'super_admin']
      );

      // WRITE (Upload): Only the authenticated worker can write to their own path.
      // Enforces:
      //   - Uploader must be the workerId in the path (no impersonation)
      //   - File must be PDF or PNG only (MIME type check)
      //   - File size must be ≤ 5MB
      allow write: if request.auth != null
        && request.auth.uid == workerId
        && request.resource.contentType in ['application/pdf', 'image/png']
        && request.resource.size <= 5 * 1024 * 1024;  // 5MB in bytes

      // DELETE: Only super_admins can delete stored attachments.
      allow delete: if request.auth != null &&
        firestore.get(
          /databases/(default)/documents/users/$(request.auth.uid)
        ).data.role == 'super_admin';
    }
  }
}
```

**Note on MIME spoofing:** Storage rules check `contentType` as declared by the client SDK, not by sniffing the binary. For a fully hardened system, a Cloud Function trigger on `google.storage.object.finalize` can validate the true binary signature (magic bytes). This is out of scope for the current sprint but noted for future hardening.

---

### 1.3 Firestore Schema Additions — `workLogs` Documents

The existing `workLogs` subcollection lives at `projects/{projectId}/workLogs/{logId}`. Add the following fields. **All new fields are optional** — existing worklog documents without them will not break any query or UI.

```
projects/{projectId}/workLogs/{logId}
  │
  ├── [ALL EXISTING FIELDS — heading, description, createdBy, etc. — UNCHANGED]
  │
  ├── // ── NEW: Attachment Fields ──────────────────────────────────────────
  ├── attachmentUrl:   string | null
  │   // Firebase Storage download URL (permanent, token-based).
  │   // null = no attachment on this log entry.
  │
  ├── attachmentType:  string | null
  │   // "pdf" | "png" | null
  │   // Stored separately so the UI can render the correct icon/viewer
  │   // without fetching the file or parsing the URL.
  │
  └── attachmentFileName: string | null
      // Original filename for display in the UI (e.g. "api_proof.pdf").
      // Stored at upload time before the timestamp prefix is added.
```

---

### 1.4 Firestore Schema Additions — `shifts` Documents

The existing `shifts` subcollection lives at `users/{userId}/shifts/{shiftId}`. Add the following fields. All fields are optional on existing documents.

```
users/{userId}/shifts/{shiftId}
  │
  ├── [ALL EXISTING FIELDS — status, startTime, endTime, durationMinutes,
  │    isValidated, lastHeartbeat, projectId, etc. — UNCHANGED]
  │
  ├── // ── NEW: Break Tracking Fields ──────────────────────────────────────
  ├── allowedBreakMinutes:    number
  │   // The break allowance configured by the admin at the time this shift
  │   // was started. Default: 30. Copied from user's salary config on shift
  │   // creation so it's immutable per-shift (admin changing the setting
  │   // mid-shift won't retroactively affect an active shift).
  │
  ├── breaks: array of {
  │     breakId:             string     // uuid generated client-side
  │     breakStartTime:      Timestamp  // When worker clicked "Take Break"
  │     breakEndTime:        Timestamp | null  // null while break is active
  │     breakDurationMinutes: number    // Computed on stopBreak()
  │     exceededMinutes:     number     // max(0, breakDurationMinutes - allowedBreakMinutes)
  │                                    // 0 if within limit; positive if overage
  │     wasExceeded:         boolean    // true if exceededMinutes > 0
  │   }
  │   // Array of all break sessions in this shift. Multiple breaks are allowed.
  │   // A shift in "on_break" status has a breaks entry where breakEndTime === null.
  │
  ├── totalBreakMinutes:     number
  │   // Sum of all breakDurationMinutes across the breaks array.
  │   // Updated on each stopBreak() call.
  │
  ├── totalExceededBreakMinutes: number
  │   // Sum of all exceededMinutes across the breaks array.
  │   // This is the amount subtracted from billable time.
  │
  └── status:  string
      // Extended from existing values. Now includes "on_break" in addition to
      // "active" | "completed" | "expired". The heartbeat continues to run
      // normally during a break — the worker must still confirm presence.
```

---

## 2. Worklog Attachment Architecture

### 2.1 `storageService.js` — Upload Utility

**File:** `src/services/storageService.js`

```js
import {
  ref, uploadBytesResumable, getDownloadURL
} from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Uploads a worklog attachment to Firebase Storage.
 * Returns the permanent download URL and file metadata on completion.
 *
 * @param {File}     file       - The File object from the file input (PDF or PNG)
 * @param {string}   projectId  - Firestore project document ID
 * @param {string}   workerId   - Firestore user document ID (the uploader)
 * @param {Function} onProgress - Optional callback: (percent: number) => void
 * @returns {Promise<{ downloadUrl: string, attachmentType: string, attachmentFileName: string }>}
 */
export async function uploadWorklogAttachment(file, projectId, workerId, onProgress) {
  // ── 1. Client-side validation (mirrors Storage rules as a fast UX check) ──
  const ALLOWED_TYPES = ['application/pdf', 'image/png'];
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Only PDF and PNG files are allowed.');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('File size must be 5MB or less.');
  }

  // ── 2. Build the unique storage path ──────────────────────────────────────
  const timestamp    = Date.now();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); // sanitize
  const storagePath  = `worklogs/${projectId}/${workerId}/${timestamp}_${safeFilename}`;
  const storageRef   = ref(storage, storagePath);

  // ── 3. Upload with progress reporting ────────────────────────────────────
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      uploadedBy: workerId,
      projectId,
      originalFilename: file.name,
    },
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        onProgress?.(percent);
      },
      (error) => reject(error),
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({
          downloadUrl,
          attachmentType:     file.type === 'application/pdf' ? 'pdf' : 'png',
          attachmentFileName: file.name,
        });
      }
    );
  });
}
```

---

### 2.2 Worklog Submission Flow — Updated

The updated worklog submission (inside `addWorkLog()`, whatever function currently handles this in `WorkLogSection.jsx`) must now optionally accept attachment data and write it alongside the text fields.

**Updated payload shape for `addDoc` / `addWorkLog`:**

```js
// Inside the worklog submission handler — only the NEW fields are shown.
// Merge these into the existing payload object:
{
  // ...all existing fields (heading, description, createdBy, etc.)...

  // NEW: attachment fields — only present if admin/worker staged a file
  attachmentUrl:      stagedAttachment?.downloadUrl      ?? null,
  attachmentType:     stagedAttachment?.attachmentType   ?? null,
  attachmentFileName: stagedAttachment?.attachmentFileName ?? null,
}
```

The `stagedAttachment` object is populated **before** the form is submitted, by the "📎 Attach Proof" button flow described in §2.3. It is `null` if no file was attached.

---

### 2.3 `WorkLogSection.jsx` — Form UI Changes

**File:** `src/components/worklog/WorkLogSection.jsx` (or wherever it lives)

This is a surgical addition to the existing form. **Do not restructure the form** — add only the three new UI elements below.

#### 2.3.1 New State Variables (add to existing component state)

```js
// Add these alongside existing form state:
const fileInputRef            = useRef(null);
const [stagedFile, setStagedFile]         = useState(null);   // File object
const [stagedAttachment, setStagedAttachment] = useState(null); // { downloadUrl, attachmentType, attachmentFileName }
const [uploadProgress, setUploadProgress] = useState(0);
const [isUploading, setIsUploading]       = useState(false);
const [fileError, setFileError]           = useState(null);
```

#### 2.3.2 File Staging Handler

```js
// Called when the hidden file input fires onChange.
// Does NOT upload yet — stages the file for preview/confirmation.
const handleFileStaged = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setFileError(null);

  // Client-side validation (mirrors Storage rules)
  if (!['application/pdf', 'image/png'].includes(file.type)) {
    setFileError('Only PDF or PNG files are allowed.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setFileError('File must be 5MB or less.');
    return;
  }

  setStagedFile(file);
  setStagedAttachment(null); // Reset any previously uploaded URL
};
```

#### 2.3.3 Upload & Submit Handler

```js
// Called when worker clicks the main "Upload Work Log" submit button.
// If a file is staged but not yet uploaded, it uploads first, then submits.
const handleSubmitWorkLog = async (formData) => {
  let attachmentData = null;

  if (stagedFile && !stagedAttachment) {
    // File is staged but not yet uploaded — upload now
    setIsUploading(true);
    try {
      attachmentData = await uploadWorklogAttachment(
        stagedFile,
        projectId,
        currentUser.uid,
        setUploadProgress
      );
      setStagedAttachment(attachmentData);
    } catch (err) {
      setFileError(err.message);
      setIsUploading(false);
      return; // Abort — don't submit the worklog if upload fails
    }
    setIsUploading(false);
  } else if (stagedAttachment) {
    attachmentData = stagedAttachment; // Already uploaded (e.g., re-submit after error)
  }

  // Proceed with existing worklog submission, passing attachment data
  await addWorkLog({ ...formData, attachment: attachmentData });

  // Reset attachment state after successful submission
  setStagedFile(null);
  setStagedAttachment(null);
  setUploadProgress(0);
  if (fileInputRef.current) fileInputRef.current.value = '';
};
```

#### 2.3.4 New JSX — "📎 Attach Proof" Button

Insert this block **directly beside** the existing "Upload Work Log" submit button. The hidden `<input>` is triggered programmatically to keep full styling control.

```jsx
{/* Hidden file input — triggered by the Attach button below */}
<input
  type="file"
  ref={fileInputRef}
  accept=".pdf,.png"
  className="hidden"
  onChange={handleFileStaged}
/>

{/* Attach Proof Button */}
<button
  type="button"
  onClick={() => fileInputRef.current?.click()}
  disabled={isUploading}
  className={`
    flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all
    ${stagedFile
      ? 'border-green-500 bg-green-50 text-green-700'   // File staged — green state
      : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
    }
  `}
>
  {stagedFile ? (
    <>
      <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
      <span className="truncate max-w-[120px]" title={stagedFile.name}>
        {stagedFile.name}
      </span>
    </>
  ) : (
    <>
      <Paperclip size={16} />
      <span>Attach Proof</span>
    </>
  )}
</button>

{/* Upload progress bar — visible only while uploading */}
{isUploading && (
  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
    <div
      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
      style={{ width: `${uploadProgress}%` }}
    />
  </div>
)}

{/* File validation error */}
{fileError && (
  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
    <AlertCircle size={12} /> {fileError}
  </p>
)}
```

**Lucide icons needed:** `CheckCircle`, `Paperclip`, `AlertCircle` — all available in `lucide-react`.

---

### 2.4 Displaying Attachments in `WorkHourSection.jsx`

**File:** `src/pages/WorkHour/WorkHourSection.jsx` (and child components)

In the day-detail panel (both Admin view and Worker view), where individual worklog entries are listed, add the following block **below** the existing description text for each log entry:

```jsx
{/* Attachment display — rendered only when attachmentUrl is present */}
{log.attachmentUrl && (
  <div className="mt-2 flex items-center gap-2">
    {log.attachmentType === 'pdf' ? (
      <FileText size={14} className="text-red-500 flex-shrink-0" />
    ) : (
      <ImageIcon size={14} className="text-blue-500 flex-shrink-0" />
    )}
    <a
      href={log.attachmentUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-blue-600 hover:underline truncate max-w-[200px]"
      title={log.attachmentFileName ?? 'View Attachment'}
    >
      {log.attachmentFileName ?? 'View Proof'}
    </a>
    <span className="text-xs text-gray-400 uppercase">
      {log.attachmentType}
    </span>
  </div>
)}
```

**Access rules enforced at display layer:**
- Worker view: only renders worklogs where `log.createdBy === currentUser.uid` — they can only see their own attachments.
- Admin view: renders all worklogs for the project — admins see all attachments.

**Lucide icons needed:** `FileText`, `Image` (import as `ImageIcon` to avoid DOM name conflict).

---

## 3. The Smart Break System — ShiftContext Math

### 3.1 Break System Overview

The break system applies **only to workers whose `salary.type === 'monthly'`**. The "Take Break" button must not render for workers on `project` or `hourly` salary types. This gate is applied in `FloatingShiftTimer.jsx` by reading `userProfile.salary.type` from the Auth context.

```
BREAK STATES:
  working  ──── [Take Break] ────►  on_break (within limit)
                                          │
                                          ▼
                                    on_break (exceeded)  ← timer glows red
                                          │
                               [Stop Break] (manual — required)
                                          │
                                          ▼
                                  back to working
```

### 3.2 New State in `ShiftContext.jsx`

Add the following state variables to `ShiftContext`. These live alongside the existing `shiftState`, `elapsedSeconds`, etc.:

```js
// ── BREAK STATE (add to existing ShiftContext state) ──────────────────────

// Whether the worker is currently on a break
const [isOnBreak, setIsOnBreak] = useState(false);

// The timestamp (ms) when the current break started (Date.now())
const breakStartRef = useRef(null);

// Live seconds elapsed in the CURRENT break (updated by the tick interval)
const [currentBreakSeconds, setCurrentBreakSeconds] = useState(0);

// The configured limit in minutes (fetched from Firestore config or default 30)
const [allowedBreakMinutes, setAllowedBreakMinutes] = useState(30);

// Whether the CURRENT break has exceeded the allowed limit
const [breakExceeded, setBreakExceeded] = useState(false);

// Total excess seconds accumulated across ALL breaks in this shift
// This is subtracted from elapsedSeconds for payroll purposes
const totalExceededSecondsRef = useRef(0);
```

---

### 3.3 The Core Tick Loop — Break Math

The existing tick `setInterval` (every 1 second) must be extended to handle break calculations. Find the existing `useEffect` that runs the 1-second interval and add the break math block inside it:

```js
// INSIDE the existing 1-second tick interval — add this block:

if (isOnBreak && breakStartRef.current) {
  const breakElapsedSeconds = Math.floor(
    (Date.now() - breakStartRef.current) / 1000
  );
  setCurrentBreakSeconds(breakElapsedSeconds);

  const allowedBreakSeconds = allowedBreakMinutes * 60;

  if (breakElapsedSeconds > allowedBreakSeconds) {
    // ── Break has exceeded the allowed limit ──────────────────────────────
    if (!breakExceeded) {
      // First tick that crosses the threshold — set exceeded flag
      setBreakExceeded(true);
    }

    // Calculate excess seconds beyond the allowed limit
    const excessSeconds = breakElapsedSeconds - allowedBreakSeconds;

    // The worker is NOT earning time for this excess.
    // We track the CURRENT excess separately from totalExceededSecondsRef
    // because the worker might stop the break at any excess amount.
    // We will commit the final excess to totalExceededSecondsRef in stopBreak().

    // The displayed elapsedSeconds must NOT include the excess.
    // elapsedSeconds is driven from (shiftStartTime to now) in existing code.
    // SUBTRACT the current excess from the displayed total:
    // This read is done in the UI:
    //   billableElapsedSeconds = elapsedSeconds - currentExcessSeconds
    // where currentExcessSeconds = max(0, currentBreakSeconds - allowedBreakSeconds)

  } else {
    // Within limit — break time counts as paid time. No subtraction needed.
    if (breakExceeded) setBreakExceeded(false); // Reset if somehow went back (edge case)
  }
}
```

**Key math note:** The existing `elapsedSeconds` value in `ShiftContext` represents raw wall-clock time since shift start. The break system introduces a derived value `billableElapsedSeconds` which is what gets shown on the timer and used for payroll. Never modify `elapsedSeconds` directly — always derive billable time from it:

```js
// Computed value — derive in ShiftContext and expose via context:
const currentExcessSeconds = isOnBreak
  ? Math.max(0, currentBreakSeconds - (allowedBreakMinutes * 60))
  : 0;

const billableElapsedSeconds = Math.max(
  0,
  elapsedSeconds                          // raw wall clock
  - totalExceededSecondsRef.current       // committed excess from PAST breaks
  - currentExcessSeconds                  // live excess from CURRENT break
);
```

Expose `billableElapsedSeconds` from the context. All UI components that display time (`FloatingShiftTimer`, salary calculation hooks) must use `billableElapsedSeconds`, not raw `elapsedSeconds`.

---

### 3.4 `startBreak()` — New Context Function

```js
/**
 * Called when worker clicks "Take Break".
 * Records break start in Firestore and activates break mode locally.
 */
const startBreak = async () => {
  if (!activeShiftId || isOnBreak) return;

  const now = new Date();
  const breakId = crypto.randomUUID(); // or use a simple timestamp string

  // ── 1. Update Firestore — push a new break entry into the breaks array ──
  const shiftRef = doc(db, 'users', currentUser.uid, 'shifts', activeShiftId);
  await updateDoc(shiftRef, {
    status: 'on_break',
    // Use arrayUnion to push the new break object into the breaks array.
    // Note: arrayUnion with objects works if the object is identical —
    // since breakId is unique this is always safe.
    breaks: arrayUnion({
      breakId,
      breakStartTime:       Timestamp.fromDate(now),
      breakEndTime:         null,
      breakDurationMinutes: 0,
      exceededMinutes:      0,
      wasExceeded:          false,
    }),
    updatedAt: serverTimestamp(),
  });

  // ── 2. Update local state ────────────────────────────────────────────────
  breakStartRef.current = Date.now();
  setIsOnBreak(true);
  setCurrentBreakSeconds(0);
  setBreakExceeded(false);

  // Store the breakId so stopBreak() can reference it
  activeBreakIdRef.current = breakId;
};
```

Add `activeBreakIdRef = useRef(null)` to the context state block.

---

### 3.5 `stopBreak()` — New Context Function

```js
/**
 * Called when worker clicks "Stop Break".
 * Commits break duration to Firestore, calculates excess, and updates
 * the totalExceededSecondsRef so future billableElapsedSeconds is correct.
 */
const stopBreak = async () => {
  if (!activeShiftId || !isOnBreak || !breakStartRef.current) return;

  const now                 = new Date();
  const breakEndMs          = Date.now();
  const breakDurationMs     = breakEndMs - breakStartRef.current;
  const breakDurationMins   = parseFloat((breakDurationMs / 60000).toFixed(2));
  const allowedMins         = allowedBreakMinutes;
  const exceededMins        = parseFloat(Math.max(0, breakDurationMins - allowedMins).toFixed(2));
  const wasExceeded         = exceededMins > 0;

  // Commit excess seconds to the running total (persists across multiple breaks)
  const exceededSeconds = exceededMins * 60;
  totalExceededSecondsRef.current += exceededSeconds;

  // ── 1. Update Firestore ──────────────────────────────────────────────────
  // Firestore does not support updating a specific object inside an array
  // by ID in a single atomic operation without reading first.
  // Strategy: read the breaks array, find the entry by breakId, update it,
  // then write the entire updated array back with updateDoc.

  const shiftRef  = doc(db, 'users', currentUser.uid, 'shifts', activeShiftId);
  const shiftSnap = await getDoc(shiftRef);
  const shiftData = shiftSnap.data();

  const updatedBreaks = (shiftData.breaks ?? []).map((b) => {
    if (b.breakId !== activeBreakIdRef.current) return b;
    return {
      ...b,
      breakEndTime:         Timestamp.fromDate(now),
      breakDurationMinutes: breakDurationMins,
      exceededMinutes:      exceededMins,
      wasExceeded,
    };
  });

  // Recompute running totals for the shift document
  const totalBreakMins = updatedBreaks.reduce(
    (sum, b) => sum + (b.breakDurationMinutes ?? 0), 0
  );
  const totalExceededMins = updatedBreaks.reduce(
    (sum, b) => sum + (b.exceededMinutes ?? 0), 0
  );

  await updateDoc(shiftRef, {
    status:                      'active',  // Back to active after break
    breaks:                      updatedBreaks,
    totalBreakMinutes:           parseFloat(totalBreakMins.toFixed(2)),
    totalExceededBreakMinutes:   parseFloat(totalExceededMins.toFixed(2)),
    updatedAt:                   serverTimestamp(),
  });

  // ── 2. Reset local break state ───────────────────────────────────────────
  breakStartRef.current       = null;
  activeBreakIdRef.current    = null;
  setIsOnBreak(false);
  setCurrentBreakSeconds(0);
  setBreakExceeded(false);
};
```

---

### 3.6 Context Export — Updated Values

Update the ShiftContext `value` object to expose all new break-related values and functions:

```js
// Add these to the existing context value object:
const contextValue = {
  // ...all existing exports (shiftState, elapsedSeconds, startShift, endShift, etc.)...

  // ── NEW: Break system exports ────────────────────────────────────────────
  isOnBreak,
  currentBreakSeconds,
  allowedBreakMinutes,
  breakExceeded,
  billableElapsedSeconds,   // REPLACES raw elapsedSeconds for display/payroll
  startBreak,
  stopBreak,
};
```

---

### 3.7 Break Data in Worklogs

When a shift ends (existing `endShift()` function), the shift document already accumulates break data via the `breaks` array and `totalExceededBreakMinutes`. The worklog auto-validation mechanism (described in `CRM_Project_Summary_Worklog.md`) copies `taskHeading` and `taskDescription` into the shift — extend this to also copy break summary data:

```js
// Inside the auto-validation updateDoc call (when a worklog is submitted):
{
  isValidated:              true,
  projectId:                currentProjectId,
  taskHeading:              logData.heading,
  taskDescription:          logData.description,
  validationMethod:         'auto_work_log',
  // NEW: copy attachment data into the shift for cross-reference
  attachmentUrl:            logData.attachmentUrl    ?? null,
  attachmentType:           logData.attachmentType   ?? null,
}
```

---

## 4. Floating Timer UI Updates

### 4.1 Overview of Changes to `FloatingShiftTimer.jsx`

The floating timer receives three additive changes:
1. A "Take Break / Stop Break" toggle button — shown only for `monthly` salary type workers.
2. Conditional styling: the timer glows red when `breakExceeded === true`.
3. Display of `billableElapsedSeconds` instead of raw `elapsedSeconds`.

---

### 4.2 Break Button — JSX Addition

Inside `FloatingShiftTimer.jsx`, consume the new context values and render the break button:

```jsx
// Inside FloatingShiftTimer.jsx — destructure from ShiftContext:
const {
  shiftState,
  billableElapsedSeconds,  // Use this instead of elapsedSeconds
  isOnBreak,
  currentBreakSeconds,
  allowedBreakMinutes,
  breakExceeded,
  startBreak,
  stopBreak,
  // ...other existing values
} = useShift();

// Gate: only render break controls for monthly salary workers
const { userProfile } = useAuth();
const isMonthlyWorker = userProfile?.salary?.type === 'monthly';
```

```jsx
{/* Break button — only when shift is active AND worker is monthly-paid */}
{shiftState === 'active' && isMonthlyWorker && (
  <button
    onClick={isOnBreak ? stopBreak : startBreak}
    className={`
      flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
      transition-all duration-200 select-none
      ${isOnBreak
        ? breakExceeded
          ? 'bg-red-100 text-red-700 border border-red-400 hover:bg-red-200'  // Exceeded
          : 'bg-amber-100 text-amber-700 border border-amber-400 hover:bg-amber-200' // On break, within limit
        : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'  // Working
      }
    `}
  >
    {isOnBreak ? (
      <>
        <Coffee size={12} className={breakExceeded ? 'text-red-600' : 'text-amber-600'} />
        Stop Break
        {/* Live break countdown / overrun indicator */}
        <span className={`font-mono ${breakExceeded ? 'text-red-700 font-bold' : ''}`}>
          {formatSeconds(currentBreakSeconds)}
        </span>
      </>
    ) : (
      <>
        <Coffee size={12} />
        Break
      </>
    )}
  </button>
)}
```

**Lucide icon needed:** `Coffee` — available in `lucide-react`.

---

### 4.3 Red Glow Styling — Timer Container

The **entire timer container** must pulse red when `breakExceeded === true`. Apply this via Tailwind's `animate-pulse` class and a conditional border/shadow:

```jsx
{/* The outermost timer container div — update className: */}
<div
  style={{ left: pos.x, top: pos.y }}   // existing drag positioning
  className={`
    fixed z-50 flex flex-col items-center gap-1 p-2 rounded-2xl shadow-lg
    cursor-grab active:cursor-grabbing select-none
    transition-all duration-300
    ${breakExceeded
      ? 'bg-red-50 border-2 border-red-500 shadow-red-300 shadow-lg animate-pulse'
      : shiftState === 'active'
        ? 'bg-blue-50 border border-blue-300'
        : shiftState === 'heartbeat_required'
          ? 'bg-amber-50 border border-amber-400 animate-pulse'
          : 'bg-white border border-gray-200'
    }
  `}
  onPointerDown={handlePointerDown}
>
```

**Tailwind `animate-pulse`** cycles opacity 1 → 0.5 → 1 in a 2-second loop — this creates a clear visual alarm without any JavaScript animation. No additional CSS is needed.

---

### 4.4 Timer Display — Billable vs Raw Time

Update the time display inside the timer to show `billableElapsedSeconds`:

```jsx
{/* Replace any reference to raw elapsedSeconds with billableElapsedSeconds */}
<span className="font-mono text-sm font-bold">
  {formatSeconds(billableElapsedSeconds)}
</span>

{/* When on break: show a sub-label indicating break status */}
{isOnBreak && (
  <span className={`text-xs ${breakExceeded ? 'text-red-600 font-semibold' : 'text-amber-600'}`}>
    {breakExceeded
      ? `⚠ Break exceeded by ${formatSeconds(currentBreakSeconds - allowedBreakMinutes * 60)}`
      : `☕ On break — ${formatSeconds(currentBreakSeconds)}`
    }
  </span>
)}
```

---

### 4.5 Break Exceeded Alert — Escalating Warning

For additional visibility when a break is exceeded, render a persistent warning banner **at the top of the screen** (similar to the existing heartbeat banner), so the worker cannot miss it even if the floating timer is moved to a corner:

```jsx
{/* src/components/global/BreakExceededBanner.jsx — NEW component */}
{/* Rendered in App.jsx alongside HeartbeatConfirmModal */}

export function BreakExceededBanner() {
  const { breakExceeded, currentBreakSeconds, allowedBreakMinutes, stopBreak } = useShift();
  if (!breakExceeded) return null;

  const overrunSeconds = currentBreakSeconds - allowedBreakMinutes * 60;

  return (
    <div className="
      fixed top-0 left-0 right-0 z-[9999]
      bg-red-600 text-white px-4 py-2
      flex items-center justify-between
      animate-pulse
    ">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle size={16} />
        Break limit exceeded by {formatSeconds(overrunSeconds)}.
        This time is NOT billable. Stop your break immediately.
      </div>
      <button
        onClick={stopBreak}
        className="px-3 py-1 bg-white text-red-600 rounded-md text-sm font-bold
                   hover:bg-red-50 transition-colors"
      >
        Stop Break Now
      </button>
    </div>
  );
}
```

Register `<BreakExceededBanner />` in `App.jsx` **above** all route content (same level as `<FloatingShiftTimer />` and `<HeartbeatConfirmModal />`):

```jsx
// App.jsx — add alongside existing global overlays:
<ShiftProvider>
  <FloatingShiftTimer />
  <HeartbeatConfirmModal />
  <BreakExceededBanner />     {/* NEW */}
  <RouterOutlet />
</ShiftProvider>
```

**Lucide icon needed:** `AlertTriangle`.

---

## 5. Admin Break Configuration

### 5.1 Where the Break Limit is Configured

The allowed break duration (default 30 minutes, customizable by admin) is stored on each worker's salary configuration document in Firestore, under the `monthly` sub-map:

```
users/{userId}.salary.monthly.allowedBreakMinutes: number
// Default: 30
// Range: 15–60 (enforce in the admin form)
```

Add this field to the `<MonthlySalaryForm />` inside `<SalaryConfigModal />` (from the Salary Dashboard Blueprint):

```jsx
{/* Add to MonthlySalaryForm.jsx */}
<div>
  <label className="text-sm font-medium text-gray-700">
    Allowed Break Duration (minutes)
  </label>
  <input
    type="number"
    min={15}
    max={60}
    step={5}
    {...register('monthly.allowedBreakMinutes', {
      required: true,
      min: 15,
      max: 60,
      valueAsNumber: true,
    })}
    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
               focus:border-indigo-500 focus:ring-indigo-500 text-sm"
  />
  <p className="mt-1 text-xs text-gray-500">
    Time within this limit counts as paid. Overrun is deducted. (15–60 min)
  </p>
</div>
```

### 5.2 Loading Break Limit in ShiftContext

When `startShift()` is called in `ShiftContext`, read the worker's configured break limit and:
1. Store it in the shift document (`allowedBreakMinutes` field — see §1.4).
2. Set local `allowedBreakMinutes` state.

```js
// Inside startShift() — after fetching user profile or from existing userProfile:
const configuredLimit = userProfile?.salary?.monthly?.allowedBreakMinutes ?? 30;
setAllowedBreakMinutes(configuredLimit);

// Include in the new shift document payload:
{
  // ...existing shift fields...
  allowedBreakMinutes: configuredLimit,
  breaks:              [],
  totalBreakMinutes:   0,
  totalExceededBreakMinutes: 0,
}
```

On page refresh/mount reconciliation (existing `localStorage` restore logic), also restore `allowedBreakMinutes` from the recovered shift document:

```js
// In the onMount reconciliation effect — after fetching the active shift doc:
if (shiftDoc.allowedBreakMinutes) {
  setAllowedBreakMinutes(shiftDoc.allowedBreakMinutes);
}
// Also restore any accumulated excess from completed breaks in this session:
const pastExcess = shiftDoc.totalExceededBreakMinutes ?? 0;
totalExceededSecondsRef.current = pastExcess * 60;
```

---

## 6. Component & File Change Summary

### 6.1 New Files Created

| File | Purpose |
|------|---------|
| `src/services/storageService.js` | `uploadWorklogAttachment()` utility |
| `src/components/global/BreakExceededBanner.jsx` | Red break-exceeded banner rendered in App.jsx |
| `storage.rules` *(updated)* | Firebase Storage security rules for worklog attachments |

### 6.2 Existing Files Modified

| File | Changes |
|------|---------|
| `src/contexts/ShiftContext.jsx` | New state: `isOnBreak`, `breakExceeded`, `billableElapsedSeconds`, `currentBreakSeconds`, `allowedBreakMinutes`. New refs: `breakStartRef`, `activeBreakIdRef`, `totalExceededSecondsRef`. New functions: `startBreak()`, `stopBreak()`. Break math inside tick interval. Extended context exports. |
| `src/components/global/FloatingShiftTimer.jsx` | Break button (monthly workers only). Conditional red glow on `breakExceeded`. Display `billableElapsedSeconds`. Break status sub-label. |
| `src/components/worklog/WorkLogSection.jsx` | File input ref, staged file state, `handleFileStaged()`, updated submit handler, "📎 Attach Proof" button JSX, upload progress bar, file error display. |
| `src/pages/WorkHour/WorkHourSection.jsx` | Attachment display block in day-detail panel (PDF icon + PNG icon + download link). |
| `src/components/salary/MonthlySalaryForm.jsx` | `allowedBreakMinutes` number input field (15–60 range). |
| `App.jsx` | Register `<BreakExceededBanner />` in the global overlay layer. |
| `firestore.indexes.json` | No new indexes required — existing shift queries are unaffected. |
| `storage.rules` | New `worklogs/{projectId}/{workerId}/{fileName}` match block. |
| `vite.config.js` | No changes required for this update. |

### 6.3 Firestore Documents Changed

| Document Path | New Fields Added |
|--------------|-----------------|
| `projects/{projectId}/workLogs/{logId}` | `attachmentUrl`, `attachmentType`, `attachmentFileName` |
| `users/{userId}/shifts/{shiftId}` | `allowedBreakMinutes`, `breaks[]`, `totalBreakMinutes`, `totalExceededBreakMinutes`, extended `status` values |
| `users/{userId}.salary.monthly` | `allowedBreakMinutes` |

### 6.4 Helper Utility — `formatSeconds`

Both the timer and the break banner use a `formatSeconds(s)` formatter. Ensure this utility exists (it likely already does for the existing timer display). If not, add it to `src/utils/timeFormat.js`:

```js
export function formatSeconds(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
```
