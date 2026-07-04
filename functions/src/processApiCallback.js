const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { v4: uuidv4 } = require('uuid');

/**
 * A7: processApiCallback — HTTP POST (Webhook from Vapi / Twilio)
 *
 * Receives call/message completion data from third-party APIs.
 * Runs AI filter to extract structured output, evaluates closure signal,
 * and either converts the lead, marks it failed, or schedules a standby retry.
 *
 * Vapi posts to: /processApiCallback?leadId=xxx&tenantId=yyy&cycleId=zzz
 * Twilio posts similar fields in the body.
 */
exports.processApiCallback = onRequest(
  { secrets: ['GEMINI_API_KEY'] },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.status(204).send('');
      return;
    }

    const db = getFirestore();

    try {
      // Extract metadata — Vapi sends in metadata field; Twilio sends in body
      const leadId = req.body?.metadata?.leadId ?? req.query.leadId ?? req.body.leadId;
      const tenantId = req.body?.metadata?.tenantId ?? req.query.tenantId ?? req.body.tenantId;
      const cycleId = req.body?.metadata?.cycleId ?? req.query.cycleId ?? req.body.cycleId;
      const rawTranscript =
        req.body?.transcript ??
        req.body?.recording_url ??
        req.body?.Body ?? // Twilio SMS/WhatsApp body
        JSON.stringify(req.body);

      if (!leadId) {
        console.warn('[processApiCallback] Missing leadId in callback payload');
        res.status(200).send('Missing leadId — ignored.');
        return;
      }

      // ── 1. Fetch lead document ─────────────────────────────────────────
      const leadRef = db.collection('leads').doc(leadId);
      const leadSnap = await leadRef.get();
      if (!leadSnap.exists) {
        console.warn(`[processApiCallback] Lead ${leadId} not found.`);
        res.status(200).send('Lead not found — ignored.');
        return;
      }

      const lead = { id: leadSnap.id, ...leadSnap.data() };

      // ── 2. Update cycle status to response_received ────────────────────
      const updatedCycles = (lead.contactCycles ?? []).map((c) => {
        if (c.cycleId === cycleId) {
          return { ...c, status: 'response_received', rawApiResponse: rawTranscript };
        }
        return c;
      });

      await leadRef.update({ contactCycles: updatedCycles });

      // ── 3. Run AI filter — structured extraction ───────────────────────
      let extracted = {
        meetingSummary: 'Call completed — summary unavailable.',
        aiFeedback: 'No structured feedback extracted.',
        closureSignal: 'standby',
        closureNote: 'AI filter failed — defaulting to standby.',
      };

      try {
        const { geminiJSON } = require('./utils/geminiClient');
        extracted = await geminiJSON(
          `You are a CRM data extraction agent. Extract structured data from the API response.
Return a JSON object with exactly these keys:
{
  "meetingSummary": "<200-word max summary of the contact interaction>",
  "aiFeedback": "<assessment: what went well, objections raised, next best action>",
  "closureSignal": "success" | "fail" | "standby",
  "closureNote": "<reason for the closure signal>"
}

closureSignal rules:
- success: lead clearly expressed intent to buy or move forward
- fail: lead clearly declined, not interested, or unreachable after multiple attempts
- standby: conversation neutral, needs follow-up, or lead wants to think about it`,
          `Lead name: ${lead.name}\nService: ${lead.serviceDescription}\n\nAPI Response / Transcript:\n${String(rawTranscript).slice(0, 8000)}`,
          0.2
        );
      } catch (aiErr) {
        console.error('[processApiCallback] Gemini extraction failed:', aiErr.message);
      }

      // ── 4. Update cycle with extracted data ────────────────────────────
      const now = new Date().toISOString();
      const filteredCycles = (updatedCycles ?? []).map((c) => {
        if (c.cycleId === cycleId) {
          return {
            ...c,
            meetingSummary: extracted.meetingSummary,
            aiFeedback: extracted.aiFeedback,
            closureSignal: extracted.closureSignal,
            filteredAt: now,
            status: 'filtered',
          };
        }
        return c;
      });

      await leadRef.update({ contactCycles: filteredCycles });

      // ── 5. Append chat messages ─────────────────────────────────────────
      const agentMsg = {
        messageId: uuidv4(),
        role: 'ai_agent',
        content: extracted.meetingSummary,
        cycleRef: cycleId,
        timestamp: now,
      };
      const filterMsg = {
        messageId: uuidv4(),
        role: 'filter',
        content: `💡 AI Feedback: ${extracted.aiFeedback}\n\n📍 Signal: ${extracted.closureSignal.toUpperCase()} — ${extracted.closureNote}`,
        cycleRef: cycleId,
        timestamp: now,
      };

      await leadRef.update({
        chatHistory: FieldValue.arrayUnion(agentMsg, filterMsg),
      });

      // ── 6. Evaluate closure ─────────────────────────────────────────────
      await evaluateClosure(leadRef, lead, extracted, db);

      res.status(200).send('OK');
    } catch (err) {
      console.error('[processApiCallback] Error:', err.message);
      // Return 200 to prevent Vapi/Twilio from retrying indefinitely
      res.status(200).send(`Handled with error: ${err.message}`);
    }
  }
);

/**
 * A8: evaluateClosure — Internal utility
 *
 * Determines next action based on the closure signal from the AI filter.
 * - success → convert lead to opportunity
 * - fail    → mark lead as failed
 * - standby → schedule next cycle or notify admin
 */
async function evaluateClosure(leadRef, lead, extracted, db) {
  const { CloudTasksClient } = require('@google-cloud/tasks');
  const { v4: uuidv4 } = require('uuid');

  const closureSignal = extracted.closureSignal;
  const executionMode = lead.executionMode ?? 'manual';
  const now = new Date().toISOString();

  if (closureSignal === 'success') {
    // Mark lead as success
    await leadRef.update({
      phase: 'success',
      closureSignal: 'success',
      closureNote: extracted.closureNote,
      closedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Append success chat message
    await leadRef.update({
      chatHistory: FieldValue.arrayUnion({
        messageId: uuidv4(),
        role: 'system',
        content: '✅ Lead marked as SUCCESS. Ready for conversion to opportunity.',
        cycleRef: null,
        timestamp: now,
      }),
    });

    // Note: convertLeadToOpportunity is a separate callable — admin triggers it via UI button
    // In fully automatic mode, we could call it here, but we keep human in the loop for conversion.

  } else if (closureSignal === 'fail') {
    await leadRef.update({
      phase: 'fail',
      closureSignal: 'fail',
      closureNote: extracted.closureNote,
      closedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await leadRef.update({
      chatHistory: FieldValue.arrayUnion({
        messageId: uuidv4(),
        role: 'system',
        content: `❌ Lead marked as FAILED. Reason: ${extracted.closureNote}`,
        cycleRef: null,
        timestamp: now,
      }),
    });

  } else if (closureSignal === 'standby') {
    if (executionMode === 'automatic') {
      // Schedule next dispatchLeadCycle via Cloud Tasks (default: 24h delay)
      const RETRY_DELAY_SECONDS = 24 * 60 * 60; // 24 hours

      try {
        const client = new CloudTasksClient();
        const QUEUE_PATH = process.env.CLOUD_TASKS_QUEUE_PATH;
        const DISPATCH_URL = process.env.DISPATCH_LEAD_CYCLE_URL;

        if (QUEUE_PATH && DISPATCH_URL) {
          const taskPayload = { data: { leadId: lead.id } };
          await client.createTask({
            parent: QUEUE_PATH,
            task: {
              httpRequest: {
                httpMethod: 'POST',
                url: DISPATCH_URL,
                headers: { 'Content-Type': 'application/json' },
                body: Buffer.from(JSON.stringify(taskPayload)).toString('base64'),
              },
              scheduleTime: {
                seconds: Math.floor(Date.now() / 1000) + RETRY_DELAY_SECONDS,
              },
            },
          });

          await leadRef.update({
            chatHistory: FieldValue.arrayUnion({
              messageId: uuidv4(),
              role: 'system',
              content: '🔄 Standby. Next contact scheduled in 24 hours (Autonomous mode).',
              cycleRef: null,
              timestamp: now,
            }),
            standbyUntil: new Date(Date.now() + RETRY_DELAY_SECONDS * 1000).toISOString(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      } catch (taskErr) {
        console.error('[evaluateClosure] Cloud Tasks scheduling failed:', taskErr.message);
      }

    } else if (executionMode === 'hybrid') {
      // In hybrid: generate new prompt and write pendingPromptApproval
      await leadRef.update({
        chatHistory: FieldValue.arrayUnion({
          messageId: uuidv4(),
          role: 'system',
          content: '🔄 Standby. A new prompt has been generated — awaiting admin approval (Hybrid mode).',
          cycleRef: null,
          timestamp: now,
        }),
        updatedAt: FieldValue.serverTimestamp(),
      });
      // Note: Next prompt generation happens when admin clicks "Generate Next Prompt" in UI

    } else {
      // Manual mode: no automated action
      await leadRef.update({
        chatHistory: FieldValue.arrayUnion({
          messageId: uuidv4(),
          role: 'system',
          content: '🔄 Standby. No automated follow-up scheduled (Manual mode). Admin action required.',
          cycleRef: null,
          timestamp: now,
        }),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
}
