/**
 * Sanitizes a user-provided string for safe injection into AI prompts.
 * Strategy: Remove or neutralize control sequences, instruction-like patterns,
 * and characters that could break prompt boundaries.
 *
 * @param {string} input — Raw user-provided string
 * @returns {string}     — Sanitized string safe for AI prompt injection
 */
function sanitizeForAI(input) {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input;

  // ── Step 1: Strip HTML/Markdown that could embed hidden instructions ───────
  sanitized = sanitized
    .replace(/<[^>]+>/g, '')              // strip HTML tags
    .replace(/```[\s\S]*?```/g, '')       // strip code blocks
    .replace(/`[^`]+`/g, '');            // strip inline code

  // ── Step 2: Neutralize injection trigger phrases (case-insensitive) ────────
  const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous\s+|prior\s+|above\s+)?instructions?/gi,
    /forget\s+(everything|all|your\s+instructions?)/gi,
    /you\s+are\s+now\s+(a\s+)?/gi,
    /act\s+as\s+(a\s+|an\s+)?/gi,
    /pretend\s+(to\s+be|you\s+are)/gi,
    /system\s*prompt/gi,
    /jailbreak/gi,
    /refund\s+my\s+account/gi,
    /give\s+me\s+access/gi,
    /override\s+(the\s+)?(system|rules|instructions?)/gi,
    /disregard\s+(the\s+)?(above|previous|prior)/gi,
  ];

  INJECTION_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  // ── Step 3: Strip newlines in short fields (names, titles) ────────────────
  sanitized = sanitized.replace(/[\r\n]+/g, ' ');

  // ── Step 4: Trim and cap length ───────────────────────────────────────────
  sanitized = sanitized.trim().slice(0, 500); // Hard cap at 500 chars per field

  return sanitized;
}

module.exports = { sanitizeForAI };
