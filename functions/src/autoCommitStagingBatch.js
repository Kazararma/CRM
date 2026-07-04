const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

/**
 * A4: autoCommitStagingBatch — Firestore Trigger
 *
 * Fires when a staging batch document is written.
 * If importMode === 'automatic' AND status === 'auto_commit_requested'
 * AND errorCount === 0 → auto-commits all valid records to leads/ collection.
 *
 * This function does NOT fire for manual mode batches (status stays 'staging').
 */
exports.autoCommitStagingBatch = onDocumentWritten(
  { document: 'staging/{batchId}' },
  async (event) => {
    const after = event.data?.after?.data();
    if (!after) return; // Document deleted — nothing to do

    const batchId = event.params.batchId;

    // Only trigger on auto_commit_requested status
    if (after.status !== 'auto_commit_requested') return;

    // Guard: only automatic mode
    if (after.importMode !== 'automatic') return;

    const db = getFirestore();

    try {
      // ── 1. Fetch all non-discarded, valid records ──────────────────────
      const recordsSnap = await db
        .collection('staging')
        .doc(batchId)
        .collection('records')
        .where('isDiscarded', '==', false)
        .where('isValid', '==', true)
        .get();

      if (recordsSnap.empty) {
        console.log(`[autoCommitStagingBatch] No valid records in batch ${batchId}`);
        await db.collection('staging').doc(batchId).update({ status: 'committed' });
        return;
      }

      // ── 2. Batch write valid records to leads/ ─────────────────────────
      const leadsRef = db.collection('leads');
      const writeBatch = db.batch();
      const importedLeadIds = [];
      const tenantId = after.tenantId;

      recordsSnap.docs.forEach((recordDoc) => {
        const record = recordDoc.data();
        const newLeadRef = leadsRef.doc();
        importedLeadIds.push(newLeadRef.id);

        writeBatch.set(newLeadRef, {
          // ── v2 core fields ──────────────────────────────────────────
          tenantId,
          name: record.name,
          place: record.place,
          email: record.email,
          phone: record.phone,
          linkedin: record.linkedin ?? null,
          instagram: record.instagram ?? null,
          serviceDescription: record.serviceDescription,
          category: record.category,
          phase: 'initial',
          executionMode: 'manual', // safe default — admin can change to auto
          contactCycles: [],
          currentCycleIndex: 0,
          chatHistory: [],
          manualInstructionHistory: [],
          closureSignal: null,
          closureNote: null,
          convertedToOpportunityId: null,
          // ── Legacy preserved fields ─────────────────────────────────
          isConverted: false,
          isDeleted: false,
          // ── Import metadata ─────────────────────────────────────────
          importedFromBatch: batchId,
          importSource: after.importSource ?? 'auto_commit',
          // ── Timestamps ──────────────────────────────────────────────
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: 'system',
        });

        // Mark record as committed
        writeBatch.update(recordDoc.ref, {
          status: 'committed',
          committedLeadId: newLeadRef.id,
        });
      });

      // Mark batch as committed
      writeBatch.update(db.collection('staging').doc(batchId), {
        status: 'committed',
        committedAt: FieldValue.serverTimestamp(),
        committedBy: 'system',
      });

      await writeBatch.commit();

      console.log(
        `[autoCommitStagingBatch] Auto-committed ${importedLeadIds.length} leads from batch ${batchId}`
      );

      // ── 3. Trigger autonomous outreach if enabled ────────────────────
      if (after.autonomousOutreachEnabled && after.outreachChannel && importedLeadIds.length > 0) {
        // Set executionMode to 'automatic' for these leads and mark for dispatch
        const autoUpdateBatch = db.batch();
        importedLeadIds.forEach((leadId) => {
          autoUpdateBatch.update(leadsRef.doc(leadId), {
            executionMode: 'automatic',
            pendingFirstDispatch: true,
            outreachChannel: after.outreachChannel,
            campaignContext: after.campaignContext ?? null,
          });
        });
        await autoUpdateBatch.commit();
        console.log(`[autoCommitStagingBatch] Marked ${importedLeadIds.length} leads for auto-dispatch.`);
      }
    } catch (err) {
      console.error(`[autoCommitStagingBatch] Error for batch ${batchId}:`, err.message);
      // Update batch to error state
      await db
        .collection('staging')
        .doc(batchId)
        .update({ status: 'error', errorMessage: err.message })
        .catch(() => {});
    }
  }
);
