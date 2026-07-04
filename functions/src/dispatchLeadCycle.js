const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { v4: uuidv4 } = require('uuid');

/**
 * A6: dispatchLeadCycle — Callable Cloud Function
 *
 * Primary orchestrator for the autonomous lead contact loop.
 * Steps:
 *  1. Fetch lead + tenant AI settings
 *  2. Engineer the prompt (assembles from all context sources)
 *  3. In hybrid mode → write PromptApproval and pause
 *  4. In manual/auto mode → dispatch to Vapi or Twilio
 *  5. Create ContactCycle record and update lead phase/chat history
 */
exports.dispatchLeadCycle = onCall(
  { secrets: ['GEMINI_API_KEY', 'ENCRYPTION_SECRET'] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Not authenticated.');

    const { leadId, approvedPrompt } = request.data;
    if (!leadId) throw new HttpsError('invalid-argument', 'leadId is required.');

    const db = getFirestore();
    const crypto = require('crypto');
    const { decryptField } = require('./utils/decryptField');
    const axios = require('axios');

    // ── 1. Fetch lead document ─────────────────────────────────────────────
    const leadRef = db.collection('leads').doc(leadId);
    const leadSnap = await leadRef.get();
    if (!leadSnap.exists) throw new HttpsError('not-found', 'Lead not found.');

    const lead = { id: leadSnap.id, ...leadSnap.data() };

    // Validate phase
    const allowedPhases = ['initial', 'contacted'];
    if (!allowedPhases.includes(lead.phase)) {
      throw new HttpsError(
        'failed-precondition',
        `Lead is in terminal phase "${lead.phase}". Cannot dispatch.`
      );
    }

    const tenantId = lead.tenantId ?? request.auth.uid;
    const executionMode = lead.executionMode ?? 'manual';
    const cycleIndex = (lead.currentCycleIndex ?? 0) + 1;

    // ── 2. Fetch tenant AI settings ───────────────────────────────────────
    const settingsSnap = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('config')
      .doc('aiSettings')
      .get();

    const aiSettings = settingsSnap.exists ? settingsSnap.data() : {};
    const masterPrompt = aiSettings.masterSystemPrompt ?? 'You are a professional sales AI agent.';

    // ── 3. Engineer the prompt (unless already approved and passed in) ────
    let finalPrompt = approvedPrompt ?? null;

    if (!finalPrompt) {
      finalPrompt = await engineerPromptInternal(lead, cycleIndex, masterPrompt, aiSettings);
    }

    // ── 4. Hybrid mode: write pending approval and STOP ───────────────────
    if (executionMode === 'hybrid' && !approvedPrompt) {
      const approvalId = uuidv4();
      await leadRef.update({
        pendingPromptApproval: {
          approvalId,
          generatedPrompt: finalPrompt,
          editedPrompt: null,
          status: 'pending',
          generatedAt: FieldValue.serverTimestamp(),
          reviewedAt: null,
          reviewedBy: null,
        },
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Append system chat message
      await appendChatMessage(leadRef, {
        role: 'system',
        content: `⏳ Cycle #${cycleIndex} prompt generated and awaiting admin approval.`,
        cycleRef: null,
      });

      return { status: 'pending_approval', approvalId };
    }

    // ── 5. Dispatch to third-party API ────────────────────────────────────
    const channel = lead.outreachChannel ?? aiSettings.defaultOutreachChannel ?? 'vapi_voice';
    const cycleId = uuidv4();

    // Create ContactCycle record (dispatched state)
    const newCycle = {
      cycleId,
      cycleIndex,
      dispatchedAt: FieldValue.serverTimestamp(),
      channel,
      promptSentToApi: finalPrompt,
      rawApiResponse: null,
      meetingSummary: null,
      aiFeedback: null,
      closureSignal: null,
      filteredAt: null,
      status: 'dispatched',
    };

    // Fetch and decrypt API keys
    const secretStr = process.env.ENCRYPTION_SECRET || '';
    const secret = /^[0-9a-fA-F]{64}$/.test(secretStr)
      ? Buffer.from(secretStr, 'hex')
      : crypto.createHash('sha256').update(secretStr).digest();

    const tenantKeysSnap = await db.collection('tenantSettings').doc(tenantId).get();

    let dispatchError = null;

    if (tenantKeysSnap.exists) {
      const tenantKeys = tenantKeysSnap.data();

      try {
        if (channel === 'vapi_voice' && tenantKeys.vapi) {
          const vapiKey = decryptField(
            {
              cipher: tenantKeys.vapi.apiKeyCipher,
              iv: tenantKeys.vapi.apiKeyIv,
              tag: tenantKeys.vapi.apiKeyTag,
            },
            secret
          );

          await axios.post(
            'https://api.vapi.ai/call/phone',
            {
              phoneNumberId: tenantKeys.vapi.phoneNumberId,
              customer: { number: lead.phone, name: lead.name },
              assistantOverrides: {
                model: { provider: 'google', model: 'gemini-2.0-flash' },
                firstMessage: `Hi, am I speaking with ${lead.name}?`,
                systemPrompt: finalPrompt,
              },
              metadata: { leadId, tenantId, cycleId },
            },
            { headers: { Authorization: `Bearer ${vapiKey}` } }
          );
          newCycle.status = 'awaiting_response';
        } else if (channel === 'twilio_whatsapp' && tenantKeys.twilio) {
          const twilioToken = decryptField(
            {
              cipher: tenantKeys.twilio.authTokenCipher,
              iv: tenantKeys.twilio.authTokenIv,
              tag: tenantKeys.twilio.authTokenTag,
            },
            secret
          );

          const Twilio = require('twilio');
          const twilioClient = new Twilio(tenantKeys.twilio.accountSid, twilioToken);
          await twilioClient.messages.create({
            from: `whatsapp:${tenantKeys.twilio.whatsappNumber}`,
            to: `whatsapp:${lead.phone}`,
            body: `Hi ${lead.name}! ${finalPrompt.slice(0, 1000)}`,
          });
          newCycle.status = 'awaiting_response';
        } else {
          console.warn(`[dispatchLeadCycle] No keys found for channel: ${channel}`);
          newCycle.status = 'error';
          dispatchError = `API keys not configured for channel: ${channel}`;
        }
      } catch (apiErr) {
        console.error(`[dispatchLeadCycle] API call failed for lead ${leadId}:`, apiErr.message);
        newCycle.status = 'error';
        dispatchError = apiErr.message;
      }
    } else {
      newCycle.status = 'error';
      dispatchError = 'Tenant API keys not found. Configure them in Settings.';
    }

    // ── 6. Update lead document atomically ────────────────────────────────
    const updatePayload = {
      phase: 'contacted',
      currentCycleIndex: cycleIndex,
      contactCycles: FieldValue.arrayUnion(newCycle),
      pendingManualInstruction: null, // Clear after each cycle
      pendingPromptApproval: null,   // Clear any pending approval
      contactedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (dispatchError) {
      updatePayload.lastDispatchError = dispatchError;
    }

    await leadRef.update(updatePayload);

    // ── 7. Append to chat history ─────────────────────────────────────────
    const chatMsg = dispatchError
      ? `❌ Cycle #${cycleIndex} dispatch failed via ${channel}: ${dispatchError}`
      : `📡 Cycle #${cycleIndex} dispatched via ${channel} at ${new Date().toISOString()}.`;

    await appendChatMessage(leadRef, {
      role: 'system',
      content: chatMsg,
      cycleRef: cycleId,
    });

    return {
      status: dispatchError ? 'error' : 'dispatched',
      cycleId,
      cycleIndex,
      channel,
      error: dispatchError ?? null,
    };
  }
);

// ── Internal helper: engineer prompt ──────────────────────────────────────────
async function engineerPromptInternal(lead, cycleIndex, masterPrompt, aiSettings) {
  const chatHistoryText =
    lead.chatHistory
      ?.filter((m) => m.role !== 'system')
      .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join('\n') || 'No prior contact history.';

  const lastCycle = lead.contactCycles?.at?.(-1);
  const lastFeedback = lastCycle?.aiFeedback ?? 'None';

  const rawSections = [
    `## MASTER COMPANY CONTEXT\n${masterPrompt}`,
    `## LEAD PROFILE\nName: ${lead.name}\nPlace: ${lead.place}\nService Requested: ${lead.serviceDescription}\nCategory: ${lead.category}`,
    `## PREVIOUS CONTACT HISTORY (${cycleIndex - 1} prior cycles)\n${chatHistoryText}`,
    `## LATEST AI FEEDBACK\n${lastFeedback}`,
    `## CUSTOM ADMIN INSTRUCTION\n${lead.pendingManualInstruction ?? 'None'}`,
    `## CAMPAIGN CONTEXT\n${aiSettings.campaignContext ?? 'None'}`,
    `## INSTRUCTIONS\nContinue the conversation with the lead. Your goal is to qualify and convert.\nRespond naturally, referencing prior context. Follow company guidelines strictly.`,
  ];

  const rawPrompt = rawSections.join('\n\n');

  // Refine via Gemini 2.0 Flash (free tier: 1,500 req/day)
  try {
    const { geminiText } = require('./utils/geminiClient');
    const refined = await geminiText(
      'You are a senior sales strategist. Refine the following prompt for a voice/WhatsApp AI agent to maximize conversion probability. Return only the refined prompt text. No preamble.',
      rawPrompt,
      0.4
    );
    return refined;
  } catch {
    // Fallback: return unrefined prompt if Gemini call fails
    return rawPrompt;
  }
}

// ── Internal helper: append chat message ──────────────────────────────────────
async function appendChatMessage(leadRef, { role, content, cycleRef }) {
  const { v4: uuidv4 } = require('uuid');
  const { FieldValue } = require('firebase-admin/firestore');

  await leadRef.update({
    chatHistory: FieldValue.arrayUnion({
      messageId: uuidv4(),
      role,
      content,
      cycleRef: cycleRef ?? null,
      timestamp: new Date().toISOString(), // ISO string (Timestamps can't go inside arrays directly)
    }),
  });
}
