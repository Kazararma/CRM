const crypto = require('crypto');

function decryptField({ cipher, iv, tag }, secretKey) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    secretKey,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipher, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

module.exports = { decryptField };
