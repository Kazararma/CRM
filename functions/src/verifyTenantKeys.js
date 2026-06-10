const { onCall, HttpsError } = require('firebase-functions/v2/https');
const Twilio = require('twilio');
const axios  = require('axios');

exports.verifyTenantKeys = onCall({ enforceAppCheck: false, cors: true }, async (request) => {
  const { twilioSid, twilioToken, twilioWhatsappNumber, vapiKey, vapiPhoneNumberId, blandKey } = request.data;
  const result = { twilio: 'fail', vapi: 'fail', bland: 'fail' };

  // ── Twilio verification ───────────────────────────────────────────────────
  try {
    const client = new Twilio(twilioSid, twilioToken);
    await client.api.accounts(twilioSid).fetch(); // Lightweight account fetch
    result.twilio = 'ok';
  } catch {
    result.twilio = 'fail';
  }

  // ── Vapi verification ─────────────────────────────────────────────────────
  if (vapiKey) {
    try {
      const response = await axios.get('https://api.vapi.ai/phone-number', {
        headers: { Authorization: `Bearer ${vapiKey}` },
        timeout: 5000,
      });
      result.vapi = response.status === 200 ? 'ok' : 'fail';
    } catch {
      result.vapi = 'fail';
    }
  }

  // ── Bland verification ────────────────────────────────────────────────────
  if (blandKey) {
    try {
      const response = await axios.get('https://api.bland.ai/v1/me', {
        headers: { authorization: blandKey },
        timeout: 5000,
      });
      result.bland = response.status === 200 ? 'ok' : 'fail';
    } catch {
      result.bland = 'fail';
    }
  }

  return result;
});
