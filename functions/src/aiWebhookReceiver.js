const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { runTransaction } = require('firebase-admin/firestore');

exports.aiWebhookReceiver = onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  // AGENT NOTE: Vapi signs webhooks with a secret header. In production,
  // verify: req.headers['x-vapi-secret'] === process.env.VAPI_WEBHOOK_SECRET
  // For now, rely on the endpoint being non-public and OIDC-scoped.

  const payload = req.body;

  // ── Extract structured data from Vapi & Bland End-of-Call payloads ────────
  const isBland = payload.call_id !== undefined;

  let leadId, transcript, callSummary, structuredOutput;

  if (isBland) {
    leadId           = payload.request_data?.leadId || payload.variables?.leadId;
    transcript       = payload.transcript ?? '';
    callSummary      = payload.summary ?? '';
    structuredOutput = payload.analysis_schema || payload.answers || {};
  } else {
    leadId           = payload.message?.call?.metadata?.leadId;
    transcript       = payload.message?.artifact?.transcript ?? '';
    callSummary      = payload.message?.analysis?.summary ?? '';
    structuredOutput = payload.message?.analysis?.structuredData ?? {};
  }

  const intentToBuy     = structuredOutput.intent_to_buy    === true;
  const extractedBudget = Number(structuredOutput.extracted_budget ?? 0);

  // ── Heuristics for Urgent Alerts ───────────────────────────────────────────
  let attentionNeeded = false;
  let isFailed = false;

  const endReason = payload.message?.call?.endReason || '';
  if (endReason === 'customer-hung-up') {
    attentionNeeded = true;
    isFailed = true;
  }
  
  const textToAnalyze = `${transcript} ${callSummary}`.toLowerCase();
  if (/angry|lawyer|sue|do not call|remove me/i.test(textToAnalyze)) {
    attentionNeeded = true;
    isFailed = true;
  }

  if (!leadId) { res.status(400).send('Missing leadId in metadata'); return; }

  const db = getFirestore();

  try {
    // ── Optimistic Locking via Firestore Transaction (Phase 6) ────────────
    await runTransaction(db, async (transaction) => {
      const leadRef  = db.collection('leads').doc(leadId);
      const leadSnap = await transaction.get(leadRef);
      if (!leadSnap.exists) throw new Error(`Lead ${leadId} not found.`);

      const lead = leadSnap.data();

      // ── State machine: determine new phase ────────────────────────────────
      let newPhase = lead.phase; // Default: no change
      if (intentToBuy && lead.phase === 'open') {
        newPhase = 'qualified';
        // AGENT NOTE: 'qualified' is the new-phase name from the legacy normalizer.
        // The Kanban onSnapshot listener will auto-move the card without any
        // additional client-side action required.
      } else if (!intentToBuy && lead.phase === 'open') {
        newPhase = 'unqualified';
      }

      // ── Append call log to lead_logs subcollection ────────────────────────
      const logRef = db.collection('leads').doc(leadId)
                       .collection('lead_logs').doc();
      transaction.set(logRef, {
        content:     `AI Call completed.\n\nSummary: ${callSummary}\n\nTranscript:\n${transcript}`,
        phase:       newPhase,
        loggedBy:    'ai_system',
        loggerName:  'AI Voice Agent',
        createdAt:   FieldValue.serverTimestamp(),
        attachments: [],
        metadata: {
          intentToBuy,
          extractedBudget,
          callSummary,
          channel: 'voice',
        },
      });

      // ── Optimistic Locking (Phase 6) ──────────────────────────────────────
      const lastUpdate = lead.updatedAt?.toMillis ? lead.updatedAt.toMillis() : 0;
      let callEndTime;
      if (isBland) {
        callEndTime = new Date(payload.completed_at || new Date().toISOString()).getTime();
      } else {
        callEndTime = new Date(payload.message?.call?.endedAt || new Date().toISOString()).getTime();
      }
      
      if (callEndTime < lastUpdate) {
        console.log(`[aiWebhookReceiver] Stale webhook for lead ${leadId}. Skipping.`);
        return;
      }

      // ── Update lead document with call results ────────────────────────────
      const leadUpdate = {
        phase:             newPhase,
        aiStatus:          isFailed ? 'failed' : 'completed',
        aiOutreachStatus:  isFailed ? 'failed' : 'completed',
        attentionNeeded:   attentionNeeded,
        lastCallSummary:   callSummary,
        extractedBudget:   extractedBudget > 0 ? extractedBudget : lead.estimatedBilling,
        updatedAt:         FieldValue.serverTimestamp(),
        _version:          (lead._version ?? 0) + 1,
      };

      // Only update financials if the AI extracted a meaningful budget
      if (extractedBudget > 0) {
        leadUpdate.estimatedBilling = extractedBudget;
      }

      transaction.update(leadRef, leadUpdate);
    });

    res.status(200).send('OK');

  } catch (err) {
    console.error('[aiWebhookReceiver] Transaction failed:', err.message);
    res.status(500).send(err.message);
  }
});
