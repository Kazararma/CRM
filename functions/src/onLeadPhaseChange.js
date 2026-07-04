const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Dispatch utilities
async function dispatchProposalViaWhatsApp({ tenantSettings, lead, pdfBuffer, companySettings }) {
  const { decryptField } = require('./utils/decryptField');
  const crypto = require('crypto');
  const secretStr = process.env.ENCRYPTION_SECRET || '';
  const secret = /^[0-9a-fA-F]{64}$/.test(secretStr)
    ? Buffer.from(secretStr, 'hex')
    : crypto.createHash('sha256').update(secretStr).digest();

  const authToken    = decryptField(tenantSettings.twilio.authTokenCipher ? {
    cipher: tenantSettings.twilio.authTokenCipher,
    iv: tenantSettings.twilio.authTokenIv,
    tag: tenantSettings.twilio.authTokenTag
  } : tenantSettings.twilio, secret);
  
  const twilioClient = require('twilio')(tenantSettings.twilio.accountSid, authToken);

  // Upload PDF to Firebase Storage first — Twilio needs a public URL for media
  const { getStorage } = require('firebase-admin/storage');
  const bucket     = getStorage().bucket();
  const pdfPath    = `proposals/${lead.leadId || Date.now()}_${Date.now()}.pdf`;
  const file       = bucket.file(pdfPath);
  await file.save(pdfBuffer, { contentType: 'application/pdf' });

  // Make the file temporarily public (1 hour) for Twilio to fetch
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  });

  const messageBody = `Hi ${lead.clientName}, thank you for speaking with us. `
    + `Please find your formal proposal attached. `
    + `We look forward to working with you on ${lead.projectTitle}. `
    + `— ${companySettings?.company?.name || 'Our Team'}`;

  await twilioClient.messages.create({
    from:      `whatsapp:${tenantSettings.twilio.whatsappNumber}`,
    to:        `whatsapp:${lead.phoneNumber}`,
    body:      messageBody,
    mediaUrl:  [signedUrl],
  });
}

const sgMail = require('@sendgrid/mail');
async function dispatchProposalViaEmail({ lead, pdfBuffer, companySettings }) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  await sgMail.send({
    to:      lead.email,
    from:    {
      email: process.env.SENDGRID_FROM_EMAIL, // Verified sender in SendGrid
      name:  companySettings?.company?.name || 'Company',
    },
    subject: `Your Proposal from ${companySettings?.company?.name || 'us'} — ${lead.projectTitle}`,
    text:    `Dear ${lead.clientName},\n\nThank you for your interest. `
           + `Please find your formal proposal attached.\n\n`
           + `Best regards,\n${companySettings?.preparedBy?.signatureText ?? companySettings?.company?.name ?? 'Our Team'}`,
    attachments: [
      {
        content:     pdfBuffer.toString('base64'),
        filename:    `Proposal_${(lead.projectTitle || 'Project').replace(/\s+/g, '_')}.pdf`,
        type:        'application/pdf',
        disposition: 'attachment',
      },
    ],
  });
}

exports.onLeadPhaseChange = onDocumentUpdated(
  { document: 'leads/{leadId}' },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();
    const leadId = event.params.leadId;

    // Only trigger when phase changes TO 'proposal'
    if (before.phase === after.phase || after.phase !== 'proposal') return;

    // Guard: Do not send automated proposal if attention is needed
    if (after.attentionNeeded === true) {
      console.log(`[onLeadPhaseChange] Aborting proposal dispatch for lead ${leadId} due to attentionNeeded flag.`);
      return;
    }

    // Prevent re-firing if proposal was already dispatched
    if (after.proposalDispatched === true) return;

    const db      = getFirestore();
    const tenantId = after.createdBy || after.tenantId; 

    try {
      // ── 1. Fetch required data ────────────────────────────────────────────
      const [settingsSnap, tenantSnap] = await Promise.all([
        db.collection('app_config').doc('company_defaults').get(),
        db.collection('tenantSettings').doc(tenantId).get(),
      ]);

      if (!tenantSnap.exists) {
        console.warn(`[onLeadPhaseChange] Missing settings for tenant ${tenantId}`);
        return;
      }

      const companySettings = settingsSnap.exists ? settingsSnap.data() : {};
      const tenantSettings  = tenantSnap.data();
      const lead            = after;

      // ── 2. Generate PDF server-side ───────────────────────────────────────
      const { generateProposalPDFBuffer } = require('./utils/generateProposalPDFServer');
      const { sanitizeForAI } = require('./utils/sanitizeForAI');
      const safeProjectTitle = sanitizeForAI(lead.projectTitle);
      const pdfBuffer = await generateProposalPDFBuffer({
        companySettings,
        lead: { ...lead, projectTitle: safeProjectTitle },
        // Default line items derived from the opportunity/lead financial data:
        lineItems: lead.proposalLineItems ?? [
          {
            description: safeProjectTitle || 'Project Implementation',
            unitPrice:   lead.estimatedBilling ?? 0,
            qty:         1,
            amount:      lead.estimatedBilling ?? 0,
          },
        ],
        totals: {
          subTotal:   lead.estimatedBilling ?? 0,
          cgst:       (lead.estimatedBilling ?? 0) * 0.09,
          sgst:       (lead.estimatedBilling ?? 0) * 0.09,
          igst:       0,
          grandTotal: (lead.estimatedBilling ?? 0) * 1.18,
          useIgst:    false,
        },
        specialTerms: sanitizeForAI(lead.proposalTerms) ?? '',
        opportunityTitle: safeProjectTitle,
      });

      // ── 3. Dispatch ───────────────────────────────────────────────────────
      const dispatchChannel = after.aiOutreachChannel ?? 'whatsapp';

      if (dispatchChannel === 'whatsapp') {
        await dispatchProposalViaWhatsApp({
          tenantSettings,
          lead,
          pdfBuffer,
          companySettings,
        });
      } else {
        await dispatchProposalViaEmail({
          lead,
          pdfBuffer,
          companySettings,
        });
      }

      // ── 4. Mark as dispatched (prevents re-trigger) ───────────────────────
      await event.data.after.ref.update({
        proposalDispatched:   true,
        proposalDispatchedAt: FieldValue.serverTimestamp(),
        proposalChannel:      dispatchChannel,
      });

    } catch (err) {
      console.error(`[onLeadPhaseChange] Proposal dispatch failed for ${leadId}:`, err.message);
      // Do not rethrow — log and move on to prevent infinite retry loops
    }
  }
);
