const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

/**
 * A9: convertLeadToOpportunity — Callable Cloud Function (Atomic Batch)
 *
 * Converts a lead in 'success' phase to an Opportunity document.
 * Uses Firestore writeBatch for atomicity — both writes succeed or both fail.
 *
 * Creates:
 *  - New document in 'opportunities/' collection
 *  - Updates lead: isConverted=true, convertedToOpportunityId=<new id>
 *  - Appends final chat message to lead
 */
exports.convertLeadToOpportunity = onCall({}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Not authenticated.');

  const { leadId } = request.data;
  if (!leadId) throw new HttpsError('invalid-argument', 'leadId is required.');

  const db = getFirestore();

  // Fetch lead
  const leadRef = db.collection('leads').doc(leadId);
  const leadSnap = await leadRef.get();
  if (!leadSnap.exists) throw new HttpsError('not-found', 'Lead not found.');

  const lead = { id: leadSnap.id, ...leadSnap.data() };

  if (lead.phase !== 'success') {
    throw new HttpsError(
      'failed-precondition',
      `Lead must be in "success" phase to convert. Current phase: "${lead.phase}".`
    );
  }

  if (lead.isConverted) {
    throw new HttpsError('already-exists', 'Lead has already been converted to an opportunity.');
  }

  // ── Atomic batch write ─────────────────────────────────────────────────────
  const batch = db.batch();

  // Step 1: Create new opportunity document
  const newOpportunityRef = db.collection('opportunities').doc();

  batch.set(newOpportunityRef, {
    // ── Mapped from lead ────────────────────────────────────────────────────
    title: lead.name + ' — ' + (lead.serviceDescription?.slice(0, 60) ?? 'Service'),
    clientName: lead.name,
    clientEmail: lead.email,
    clientPhone: lead.phone,
    clientPlace: lead.place,
    linkedin: lead.linkedin ?? null,
    instagram: lead.instagram ?? null,
    serviceDescription: lead.serviceDescription,
    category: lead.category,
    estimatedBilling: lead.estimatedBilling ?? 0,
    estimatedBudget: lead.estimatedBudget ?? 0,

    // ── Source traceability ─────────────────────────────────────────────────
    sourceLeadId: leadId,
    tenantId: lead.tenantId ?? request.auth.uid,

    // ── AI summary from last cycle ──────────────────────────────────────────
    aiClosureSummary: lead.closureNote ?? null,

    // ── Default pipeline state (admin completes in Opportunities section) ───
    stage: 'prospecting',
    probability: 50,
    value: lead.estimatedBilling ?? 0,
    assignedTo: [request.auth.uid],
    notes: `Converted from AI-qualified lead on ${new Date().toLocaleDateString()}`,

    // ── Metadata ────────────────────────────────────────────────────────────
    createdAt: FieldValue.serverTimestamp(),
    createdBy: request.auth.uid,
    updatedAt: FieldValue.serverTimestamp(),
    isArchived: false,
    convertedFromLead: true,
  });

  // Step 2: Lock the lead document
  batch.update(leadRef, {
    isConverted: true,
    convertedToOpportunityId: newOpportunityRef.id,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
    chatHistory: FieldValue.arrayUnion({
      messageId: require('uuid').v4(),
      role: 'system',
      content: `🎉 Lead successfully converted to Opportunity. Opportunity ID: ${newOpportunityRef.id}`,
      cycleRef: null,
      timestamp: new Date().toISOString(),
    }),
  });

  // Commit both writes atomically
  await batch.commit();

  return {
    success: true,
    opportunityId: newOpportunityRef.id,
  };
});
