const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

/**
 * A3: ingestWebhookLeads — HTTP Webhook Receiver (POST)
 *
 * Receives lead data from website forms or third-party lead gen tools.
 * Verifies HMAC-SHA256 signature, runs AI garbage filter, writes to staging.
 *
 * Request headers:
 *   X-Webhook-Secret: <HMAC-SHA256 of body using tenantId:webhookSecret>
 *
 * Request body (JSON):
 * {
 *   "tenantId": "...",
 *   "source": "website_form",
 *   "leads": [{ name, place, email, phone, linkedin?, instagram?, serviceDescription, category }]
 * }
 */
exports.ingestWebhookLeads = onRequest(
  { secrets: ['GEMINI_API_KEY'] },
  async (req, res) => {
    // CORS preflight
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const { tenantId, source, leads } = req.body ?? {};
    const incomingSignature = req.headers['x-webhook-secret'];

    if (!tenantId || !leads || !Array.isArray(leads)) {
      res.status(400).json({ error: 'Missing required fields: tenantId, leads[]' });
      return;
    }

    const db = getFirestore();

    try {
      // ── 1. Fetch tenant settings and verify HMAC signature ──────────────
      const tenantSnap = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('config')
        .doc('aiSettings')
        .get();

      if (!tenantSnap.exists) {
        res.status(401).json({ error: 'Unknown tenant.' });
        return;
      }

      const aiSettings = tenantSnap.data();

      if (aiSettings.webhookEnabled && aiSettings.websiteWebhookSecret) {
        // Verify HMAC: expected = HMAC-SHA256(body, tenantId:webhookSecret)
        const expectedSig = crypto
          .createHmac('sha256', `${tenantId}:${aiSettings.websiteWebhookSecret}`)
          .update(JSON.stringify(req.body))
          .digest('hex');

        if (incomingSignature !== expectedSig) {
          console.warn(`[ingestWebhookLeads] HMAC mismatch for tenant ${tenantId}`);
          res.status(401).json({ error: 'Invalid webhook signature.' });
          return;
        }
      }

      // ── 2. Run AI garbage filter ─────────────────────────────────────────
      let enrichedLeads = leads.map((l, i) => ({
        ...l,
        garbageScore: 0,
        garbageReason: null,
        isDiscarded: false,
      }));

      try {
        const { geminiJSON } = require('./utils/geminiClient');
        const scores = await geminiJSON(
          'Score each lead 0.0-1.0 for data quality. Return a JSON array only. ' +
          'Rules: 0.8+= discard (fake/placeholder), 0.5-0.79=flag, <0.5=pass. ' +
          'Fields per item: { index, garbageScore, garbageReason, correctedCategory }',
          `LEADS: ${JSON.stringify(leads)}`
        );
        const scoresArr = Array.isArray(scores) ? scores : Object.values(scores)[0];

        enrichedLeads = leads.map((l, i) => {
          const s = (scoresArr ?? []).find((x) => x.index === i) ?? { garbageScore: 0 };
          return {
            ...l,
            garbageScore: s.garbageScore ?? 0,
            garbageReason: s.garbageReason ?? null,
            isDiscarded: (s.garbageScore ?? 0) >= 0.8,
            category: s.correctedCategory ?? l.category ?? 'neutral',
          };
        });
      } catch (aiErr) {
        console.warn('[ingestWebhookLeads] Gemini filter failed, proceeding without scoring:', aiErr.message);
      }

      // ── 3. Write staging batch ───────────────────────────────────────────
      const batchRef = db.collection('staging').doc();
      const batchId = batchRef.id;

      const validLeads = enrichedLeads.filter((l) => !l.isDiscarded);
      const discardedCount = enrichedLeads.filter((l) => l.isDiscarded).length;

      const importMode = aiSettings.defaultImportMode ?? 'manual';

      await batchRef.set({
        batchId,
        tenantId,
        importedAt: FieldValue.serverTimestamp(),
        importSource: source ?? 'website_webhook',
        totalRecords: leads.length,
        validCount: validLeads.length,
        errorCount: 0,
        garbageDiscardedCount: discardedCount,
        importMode,
        autonomousOutreachEnabled: false,
        status: 'staging',
      });

      // Write individual records as subcollection
      const batchWrite = db.batch();
      enrichedLeads.forEach((lead) => {
        const recordRef = batchRef.collection('records').doc();
        batchWrite.set(recordRef, {
          recordId: recordRef.id,
          batchId,
          rawData: lead,
          garbageScore: lead.garbageScore,
          garbageReason: lead.garbageReason ?? null,
          isDiscarded: lead.isDiscarded,
          name: lead.name ?? '',
          place: lead.place ?? '',
          email: lead.email ?? '',
          phone: lead.phone ?? '',
          linkedin: lead.linkedin ?? null,
          instagram: lead.instagram ?? null,
          serviceDescription: lead.serviceDescription ?? '',
          category: lead.category ?? 'neutral',
          validationErrors: [],
          isValid: !lead.isDiscarded,
          isManuallyEdited: false,
          status: lead.isDiscarded ? 'discarded' : 'pending',
        });
      });
      await batchWrite.commit();

      // ── 4. Auto-commit if importMode === 'automatic' and 0 errors ─────────
      if (importMode === 'automatic' && validLeads.length > 0) {
        // Trigger auto-commit by updating the batch status — the Firestore trigger
        // autoCommitStagingBatch will detect this and commit to leads/
        await batchRef.update({ status: 'auto_commit_requested' });
      }

      res.status(200).json({
        success: true,
        batchId,
        totalReceived: leads.length,
        validCount: validLeads.length,
        discardedCount,
        importMode,
      });
    } catch (err) {
      console.error('[ingestWebhookLeads] Error:', err.message);
      res.status(500).json({ error: 'Internal server error.' });
    }
  }
);
