import {
  writeBatch,
  doc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

// ─── Opportunity Phase Order ───────────────────────────────────────────────────
// Kept here so the service can stamp the correct default phase on creation.
export const OPPORTUNITY_PHASES = [
  'prospecting',
  'qualification',
  'needs_analysis',
  'value_proposition',
  'decision_makers',
  'perception_analysis',
  'proposal',
  'negotiation_review',
  'closed_won',
  'closed_lost',
];

// ─────────────────────────────────────────────────────────────────────────────
//  HANDSHAKE 1 — Lead → Opportunity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a qualified lead into a new Opportunity document.
 * Atomic: all three writes (create opp, lock lead, write log) commit together.
 *
 * @param {string} leadId       - Firestore document ID of the originating lead
 * @param {Object} leadData     - Full normalized lead document object
 * @param {string} adminUid     - UID of the admin performing the conversion
 * @param {string} adminName    - Display name of the admin
 * @returns {Promise<string>}   - The new opportunity's Firestore document ID
 */
export async function convertLeadToOpportunity(leadId, leadData, adminUid, adminName) {
  if (!leadId) throw new Error('[convertLeadToOpportunity] leadId is required.');
  if (!adminUid) throw new Error('[convertLeadToOpportunity] adminUid is required.');

  const batch = writeBatch(db);

  // ── Step 1: Create the Opportunity document ────────────────────────────────
  const newOppRef = doc(collection(db, 'opportunities'));

  batch.set(newOppRef, {
    opportunityId: newOppRef.id,

    // ── Traceability ──────────────────────────────────────────────────────────
    sourceLeadId: leadId,

    // ── Identity (inherited from lead) ────────────────────────────────────────
    title:       leadData.projectTitle  || '',
    clientName:  leadData.clientName    || '',
    clientEmail: leadData.email         || '',
    clientPhone: leadData.phoneNumber   || '',
    source:      leadData.source        || '',

    // ── Classification (immutable, inherited) ─────────────────────────────────
    category: leadData.category || 'neutral',  // 'hot' | 'neutral' | 'cold'

    // ── Pipeline Phase ────────────────────────────────────────────────────────
    phase: 'prospecting',   // Always starts at Stage 1

    // ── Contacted Info (carried from the qualified lead) ──────────────────────
    contactedInfo: leadData.contactedInfo || {
      productDescription: '',
      modeOfContact:      '',
      contactDate:        null,
      endOutcome:         '',
    },

    // ── Stage sub-maps (all null/empty at creation — filled per stage) ─────────
    prospecting: {
      hasPotentialDeal: null,
    },
    qualification: {
      projectTitle:    '',
      projectBrief:    '',
      estimatedBudget: 0,
    },
    needsAnalysis: {
      detailedProjectDetails: '',
      estimatedCosts:         0,
      painPoints:             '',
    },
    valueProposition: {
      presentationNotes: '',
      keyValuePoints:    [],
    },
    decisionMakers: {
      assignedAdminIds:   [],
      assignedAdminNames: [],
      stakeholderNotes:   '',
    },
    perceptionAnalysis: {
      comparisonRows: [],
      overallNotes:   '',
    },
    proposal: {
      moneyAskedFromClient: 0,
      initialPaymentAmount: 0,
      contractStartDate:    null,
      contractEndDate:      null,
      contractTermsDetails: '',
      proposalDocumentUrl:  null,
    },
    negotiationReview: {
      moneyAgreedByClient:          0,
      initialPaymentAgreedByClient: 0,
      negotiationNotes:             '',
    },
    closedWon: {
      isConvertedToProject: false,
      convertedProjectId:   null,
      convertedAt:          null,
      convertedBy:          null,
    },
    closedLost: {
      lostReason: '',
      lostDate:   null,
    },

    // ── Soft delete ───────────────────────────────────────────────────────────
    isDeleted: false,

    // ── Metadata ──────────────────────────────────────────────────────────────
    createdAt: serverTimestamp(),
    createdBy: adminUid,
    updatedAt: serverTimestamp(),
    updatedBy: adminUid,
  });

  // ── Step 2: Lock the Lead document ────────────────────────────────────────
  const leadRef = doc(db, 'leads', leadId);

  batch.update(leadRef, {
    isConvertedToOpportunity:  true,
    convertedOpportunityId:    newOppRef.id,
    convertedToOpportunityAt:  serverTimestamp(),
    convertedToOpportunityBy:  adminUid,
    updatedAt:                 serverTimestamp(),
    updatedBy:                 adminUid,
  });

  // ── Step 3: Auto-log in lead_logs ────────────────────────────────────────
  const leadLogRef = doc(collection(db, 'leads', leadId, 'lead_logs'));

  batch.set(leadLogRef, {
    content:     `Lead converted to Opportunity by ${adminName}. Opportunity ID: ${newOppRef.id}`,
    phase:       'qualified',
    loggedBy:    adminUid,
    loggerName:  adminName,
    createdAt:   serverTimestamp(),
    attachments: [],
  });

  // ── Commit ────────────────────────────────────────────────────────────────
  await batch.commit();

  return newOppRef.id;
}


// ─────────────────────────────────────────────────────────────────────────────
//  HANDSHAKE 2 — Opportunity → Project
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a closed_won opportunity into a new Project document.
 * Atomic: create project, lock opportunity, write log — all in one batch.
 *
 * @param {string} opportunityId  - Firestore document ID of the opportunity
 * @param {Object} oppData        - Full opportunity document object
 * @param {string} adminUid       - UID of the admin performing the conversion
 * @param {string} adminName      - Display name of the admin
 * @returns {Promise<string>}     - The new project's Firestore document ID
 */
export async function convertOpportunityToProject(opportunityId, oppData, adminUid, adminName) {
  if (!opportunityId) throw new Error('[convertOpportunityToProject] opportunityId is required.');
  if (!adminUid) throw new Error('[convertOpportunityToProject] adminUid is required.');

  const batch = writeBatch(db);

  // ── Step 1: Create the Project document ───────────────────────────────────
  const newProjectRef = doc(collection(db, 'projects'));

  // Derive financial values — prefer negotiated amounts, fall back to proposal
  const finalBilling     = oppData.negotiationReview?.moneyAgreedByClient
                        || oppData.proposal?.moneyAskedFromClient
                        || 0;
  const initialPayment   = oppData.negotiationReview?.initialPaymentAgreedByClient
                        || oppData.proposal?.initialPaymentAmount
                        || 0;
  const estimatedBudget  = oppData.needsAnalysis?.estimatedCosts
                        || oppData.qualification?.estimatedBudget
                        || 0;

  batch.set(newProjectRef, {
    // ── Identity (inherited from opportunity) ─────────────────────────────────
    title:           oppData.qualification?.projectTitle || oppData.title || '',
    description:     oppData.needsAnalysis?.detailedProjectDetails || '',
    clientName:      oppData.clientName  || '',
    clientEmail:     oppData.clientEmail || '',
    clientPhone:     oppData.clientPhone || '',

    // ── Financials ────────────────────────────────────────────────────────────
    totalBilling:    finalBilling,
    initialPayment:  initialPayment,
    estimatedBudget: estimatedBudget,
    amountPaid:      0,              // Admin updates as payments come in

    // ── Contract (from proposal stage) ────────────────────────────────────────
    contractStartDate:    oppData.proposal?.contractStartDate    || null,
    contractEndDate:      oppData.proposal?.contractEndDate      || null,
    contractTermsDetails: oppData.proposal?.contractTermsDetails || '',
    proposalDocumentUrl:  oppData.proposal?.proposalDocumentUrl  || null,

    // ── Defaults the admin completes inside Projects ───────────────────────────
    status:          'pending',
    stage:           'kickoff',
    assignedWorkers: [],
    assignedAdmins:  oppData.decisionMakers?.assignedAdminIds?.length
                       ? oppData.decisionMakers.assignedAdminIds
                       : [adminUid],
    startDate:       oppData.proposal?.contractStartDate || Timestamp.now(),
    deadline:        oppData.proposal?.contractEndDate   || null,

    // ── Traceability chain ────────────────────────────────────────────────────
    sourceOpportunityId: opportunityId,
    sourceLeadId:        oppData.sourceLeadId || null,
    convertedFromOpportunity: true,

    // ── Metadata ──────────────────────────────────────────────────────────────
    isArchived: false,
    createdAt:  serverTimestamp(),
    createdBy:  adminUid,
    updatedAt:  serverTimestamp(),
    updatedBy:  adminUid,
  });

  // ── Step 2: Lock the Opportunity document ─────────────────────────────────
  const oppRef = doc(db, 'opportunities', opportunityId);

  batch.update(oppRef, {
    'closedWon.isConvertedToProject': true,
    'closedWon.convertedProjectId':   newProjectRef.id,
    'closedWon.convertedAt':          serverTimestamp(),
    'closedWon.convertedBy':          adminUid,
    updatedAt:                        serverTimestamp(),
    updatedBy:                        adminUid,
  });

  // ── Step 3: Auto-log in opportunity_logs ──────────────────────────────────
  const oppLogRef = doc(collection(db, 'opportunities', opportunityId, 'opportunity_logs'));

  batch.set(oppLogRef, {
    content:     `Opportunity converted to Project by ${adminName}. Project ID: ${newProjectRef.id}`,
    phase:       'closed_won',
    loggedBy:    adminUid,
    loggerName:  adminName,
    createdAt:   serverTimestamp(),
    attachments: [],
  });

  // ── Commit ────────────────────────────────────────────────────────────────
  await batch.commit();

  return newProjectRef.id;
}


// ─────────────────────────────────────────────────────────────────────────────
//  Phase Advance Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Advances an opportunity to the next phase and auto-logs the change.
 * Does NOT handle terminal phases (closed_won / closed_lost) — those have
 * their own dedicated handshake functions above.
 *
 * @param {string} opportunityId  - Firestore document ID
 * @param {string} newPhase       - Target phase value
 * @param {string} adminUid       - UID of the admin
 * @param {string} adminName      - Display name of the admin
 */
export async function advanceOpportunityPhase(opportunityId, newPhase, adminUid, adminName) {
  if (!opportunityId) throw new Error('[advanceOpportunityPhase] opportunityId is required.');

  const batch = writeBatch(db);

  const oppRef = doc(db, 'opportunities', opportunityId);
  batch.update(oppRef, {
    phase:     newPhase,
    updatedAt: serverTimestamp(),
    updatedBy: adminUid,
  });

  const logRef = doc(collection(db, 'opportunities', opportunityId, 'opportunity_logs'));
  batch.set(logRef, {
    content:     `Phase advanced to "${newPhase}" by ${adminName}.`,
    phase:       newPhase,
    loggedBy:    adminUid,
    loggerName:  adminName,
    createdAt:   serverTimestamp(),
    attachments: [],
  });

  await batch.commit();
}
