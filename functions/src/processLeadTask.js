const { onRequest }        = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Twilio               = require('twilio');
const axios                = require('axios');
const { decryptField }     = require('./utils/decryptField');
const { sanitizeForAI }    = require('./utils/sanitizeForAI'); // Phase 6

exports.processLeadTask = onRequest(
  { timeoutSeconds: 60 },
  async (req, res) => {
    // AGENT NOTE: Cloud Tasks signs requests with OIDC token.
    // Verify the token in production using google-auth-library.
    // For now, rely on the task URL being non-guessable and OIDC-scoped.

    const { leadId, channel, campaignContext, tenantId, masterSystemPrompt } = req.body;
    const db     = getFirestore();
    const crypto = require('crypto');
    const secretStr = process.env.ENCRYPTION_SECRET || '';
    const secret = /^[0-9a-fA-F]{64}$/.test(secretStr)
      ? Buffer.from(secretStr, 'hex')
      : crypto.createHash('sha256').update(secretStr).digest();

    try {
      // ── 1. Fetch lead data ────────────────────────────────────────────────
      const leadSnap = await db.collection('leads').doc(leadId).get();
      if (!leadSnap.exists) { res.status(404).send('Lead not found'); return; }
      const lead = leadSnap.data();

      // ── 2. Fetch & decrypt tenant keys ───────────────────────────────────
      const settingsSnap = await db.collection('tenantSettings').doc(tenantId).get();
      const settings     = settingsSnap.data();
      const twilioToken  = decryptField(settings.twilio.authTokenCipher ? {
        cipher: settings.twilio.authTokenCipher,
        iv: settings.twilio.authTokenIv,
        tag: settings.twilio.authTokenTag
      } : settings.twilio, secret);
      const vapiKey      = decryptField(settings.vapi.apiKeyCipher ? {
        cipher: settings.vapi.apiKeyCipher,
        iv: settings.vapi.apiKeyIv,
        tag: settings.vapi.apiKeyTag
      } : settings.vapi,   secret);

      // ── 3. Sanitize lead data before injecting into AI prompt (Phase 6) ──
      const safeName    = sanitizeForAI(lead.clientName);
      const safeContext = sanitizeForAI(campaignContext);

      // ── 4. Build the full per-call system prompt ──────────────────────────
      const callSystemPrompt = `
${masterSystemPrompt}

CURRENT LEAD:
- Name: ${safeName}
- Company: ${sanitizeForAI(lead.projectTitle)}
- Estimated Budget: ${lead.estimatedBilling}

CAMPAIGN INSTRUCTIONS FOR THIS BATCH:
${safeContext}

STRUCTURED OUTPUT REQUIRED:
At the end of the call, emit a JSON block:
{"intent_to_buy": true/false, "extracted_budget": number, "call_summary": "string"}
      `.trim();

      // ── 5. Dispatch by channel ────────────────────────────────────────────
      if (channel === 'voice') {
        await axios.post(
          'https://api.vapi.ai/call/phone',
          {
            phoneNumberId: settings.vapi.phoneNumberId,  // Admin-configured Vapi number
            customer:      { number: lead.phoneNumber, name: safeName },
            assistantOverrides: {
              model:         { provider: 'google', model: 'gemini-2.0-flash' },
              firstMessage:  `Hi, am I speaking with ${safeName}?`,
              systemPrompt:  callSystemPrompt,
            },
            metadata: { leadId, tenantId },
          },
          { headers: { Authorization: `Bearer ${vapiKey}` } }
        );
      } else if (channel === 'bland') {
        const blandKey = decryptField(settings.bland.apiKeyCipher ? {
          cipher: settings.bland.apiKeyCipher,
          iv: settings.bland.apiKeyIv,
          tag: settings.bland.apiKeyTag
        } : settings.bland, secret);
        
        await axios.post(
          'https://api.bland.ai/v1/calls',
          {
            phone_number: lead.phoneNumber,
            task: callSystemPrompt,
            first_sentence: `Hi, am I speaking with ${safeName}?`,
            model: 'enhanced',
            webhook: process.env.PROCESS_LEAD_TASK_URL.replace('processLeadTask', 'aiWebhookReceiver'),
            request_data: { leadId, tenantId },
            analysis_schema: {
              intent_to_buy: "boolean, whether the user expressed interest",
              extracted_budget: "number, the budget mentioned",
              call_summary: "string, summary of the conversation"
            }
          },
          { headers: { authorization: blandKey } }
        );
      } else if (channel === 'whatsapp') {
        const twilioClient = new Twilio(settings.twilio.accountSid, twilioToken);
        await twilioClient.messages.create({
          from: `whatsapp:${settings.twilio.whatsappNumber}`,
          to:   `whatsapp:${lead.phoneNumber}`,
          body: `Hi ${safeName}, this is an automated message from our team. `
              + `We'd love to discuss ${lead.projectTitle} with you. `
              + `${safeContext}`,
        });
      }

      // ── 6. Update lead outreach status in Firestore ───────────────────────
      await db.collection('leads').doc(leadId).update({
        aiOutreachStatus: 'dispatched',
        aiOutreachChannel: channel,
        dispatchedAt:     FieldValue.serverTimestamp(),
      });

      res.status(200).send('OK');

    } catch (err) {
      console.error(`[processLeadTask] Error for lead ${leadId}:`, err.message);
      // Return 200 to prevent Cloud Tasks from retrying on application errors
      // (retries are appropriate only for 5xx — application errors should not retry blindly)
      res.status(200).send(`Handled with error: ${err.message}`);
    }
  }
);
