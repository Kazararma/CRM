const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

// ── AES-256-GCM encryption utility ───────────────────────────────────────────
// AGENT NOTE: ENCRYPTION_SECRET must be a 32-byte (256-bit) secret stored
// in Firebase Secret Manager, NOT in environment variables or source code.
// Provision it with: firebase functions:secrets:set ENCRYPTION_SECRET
// Access it via: defineSecret('ENCRYPTION_SECRET') in the function definition.

function encryptField(plaintext, secretKey) {
  // secretKey: Buffer of exactly 32 bytes derived from ENCRYPTION_SECRET
  const iv         = crypto.randomBytes(12);    // 96-bit IV — GCM standard
  const cipher     = crypto.createCipheriv('aes-256-gcm', secretKey, iv);
  const encrypted  = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag(); // 16-byte authentication tag

  return {
    cipher: encrypted.toString('base64'),
    iv:     iv.toString('base64'),
    tag:    tag.toString('base64'),
  };
}

exports.encryptAndSaveTenantKeys = onCall(
  { enforceAppCheck: false, cors: true },
  async (request) => {
    // Auth check — only super_admins may call this function
    if (!request.auth) throw new HttpsError('unauthenticated', 'Not authenticated.');
    const db       = getFirestore();
    const userSnap = await db.collection('users').doc(request.auth.uid).get();
    if (userSnap.data()?.role !== 'super_admin') {
      throw new HttpsError('permission-denied', 'Insufficient role.');
    }

    const { twilioSid, twilioToken, twilioWhatsappNumber, vapiKey, vapiPhoneNumberId, blandKey, tenantId } = request.data;
    const secretStr = process.env.ENCRYPTION_SECRET || '';
    const secret = /^[0-9a-fA-F]{64}$/.test(secretStr)
      ? Buffer.from(secretStr, 'hex')
      : crypto.createHash('sha256').update(secretStr).digest();

    const twilioEncrypted = encryptField(twilioToken, secret);
    const vapiEncrypted   = vapiKey ? encryptField(vapiKey, secret) : null;
    const blandEncrypted  = blandKey ? encryptField(blandKey, secret) : null;

    const payload = {
      twilio: {
        accountSid:      twilioSid,
        whatsappNumber:  twilioWhatsappNumber,
        authTokenCipher: twilioEncrypted.cipher,
        authTokenIv:     twilioEncrypted.iv,
        authTokenTag:    twilioEncrypted.tag,
        isVerified:      true,
        verifiedAt:      FieldValue.serverTimestamp(),
      },
      updatedBy: request.auth.uid,
    };

    if (vapiKey && vapiEncrypted) {
      payload.vapi = {
        phoneNumberId: vapiPhoneNumberId,
        apiKeyCipher:  vapiEncrypted.cipher,
        apiKeyIv:      vapiEncrypted.iv,
        apiKeyTag:     vapiEncrypted.tag,
        isVerified:    true,
        verifiedAt:    FieldValue.serverTimestamp(),
      };
    }

    if (blandKey && blandEncrypted) {
      payload.bland = {
        apiKeyCipher:  blandEncrypted.cipher,
        apiKeyIv:      blandEncrypted.iv,
        apiKeyTag:     blandEncrypted.tag,
        isVerified:    true,
        verifiedAt:    FieldValue.serverTimestamp(),
      };
    }

    await db.collection('tenantSettings').doc(tenantId).set(payload, { merge: true });

    return { success: true };
  }
);
