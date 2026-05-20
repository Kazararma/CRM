import {
  writeBatch, doc, collection,
  serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Converts a lead in "final" phase to a new project document.
 * Atomic: both writes succeed or both fail.
 *
 * @param {Object} lead           - The full lead document object
 * @param {string} adminUid       - UID of the admin performing the conversion
 * @param {string} adminName      - Name of the admin performing the conversion
 * @returns {Promise<string>}     - The new project's Firestore document ID
 */
export async function convertLeadToProject(lead, adminUid, adminName) {
  const batch = writeBatch(db);

  // Use lead.leadId if available, otherwise fallback to lead.id
  const leadId = lead.leadId || lead.id;

  if (!leadId) {
    throw new Error("Cannot convert lead: lead ID is missing.");
  }

  // ── Step 1: Create the new project document ──────────────────────────────
  const newProjectRef = doc(collection(db, 'projects'));

  batch.set(newProjectRef, {
    // ── Fields mapped directly from the lead ──────────────────────────────
    title:              lead.projectTitle || '',
    description:        lead.description || '',
    clientName:         lead.clientName || '',
    clientEmail:        lead.email || '',
    clientPhone:        lead.phoneNumber || '',
    totalBilling:       lead.finalBilling || lead.estimatedBilling || 0,
    estimatedBudget:    lead.finalBudget || lead.estimatedBudget || 0,
    amountPaid:         lead.negotiation?.clientPaidAmount ?? 0,

    // ── Fields pre-populated with safe defaults for admin to complete ─────
    // The admin will complete these in the Projects section.
    status:             'pending',          // Intermediate confirmation state
    stage:              'kickoff',          // Default stage — admin updates
    assignedWorkers:    [],                 // Admin assigns workers in Projects
    assignedAdmins:     [adminUid],
    startDate:          Timestamp.now(),    // Default to today; admin can edit
    deadline:           null,               // Admin must set this

    // ── Source-of-truth reference back to the originating lead ────────────
    sourceLeadId:       leadId,             // Traceability link

    // ── Metadata ──────────────────────────────────────────────────────────
    createdAt:          serverTimestamp(),
    createdBy:          adminUid,
    updatedAt:          serverTimestamp(),
    isArchived:         false,

    // ── Marker so the Projects section can highlight "new from lead" ──────
    convertedFromLead:  true,
  });

  // ── Step 2: Lock the lead document ────────────────────────────────────────
  const leadRef = doc(db, 'leads', leadId);

  batch.update(leadRef, {
    isConverted:        true,
    convertedProjectId: newProjectRef.id,
    convertedAt:        serverTimestamp(),
    convertedBy:        adminUid,
    updatedAt:          serverTimestamp(),
    updatedBy:          adminUid,
  });

  // ── Step 3: Auto-log the conversion in lead_logs ──────────────────────────
  const logRef = doc(collection(db, 'leads', leadId, 'lead_logs'));

  batch.set(logRef, {
    content:     `Lead converted to project by ${adminName}. Project ID: ${newProjectRef.id}`,
    phase:       'final',
    loggedBy:    adminUid,
    loggerName:  adminName,
    createdAt:   serverTimestamp(),
    attachments: [],
  });

  // ── Commit all three writes atomically ────────────────────────────────────
  await batch.commit();

  return newProjectRef.id;
}
