const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { geminiJSON } = require('./utils/geminiClient');

/**
 * A2: filterGarbageRecords — AI Garbage Filter (Callable)
 *
 * Scores each raw lead record for data quality using Google Gemini 2.0 Flash.
 * Free tier: 1,500 requests/day · 1M tokens/min · no billing required.
 *
 * Garbage scoring:
 *   >= 0.8  → isDiscarded: true  (fake/placeholder/incoherent)
 *   0.5–0.79 → flagged with warning (orange in staging UI)
 *   < 0.5   → pass (clean)
 */
exports.filterGarbageRecords = onCall(
  { secrets: ['GEMINI_API_KEY'] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Not authenticated.');

    const { records } = request.data;
    if (!Array.isArray(records) || records.length === 0) {
      throw new HttpsError('invalid-argument', 'records must be a non-empty array.');
    }

    const SYSTEM_INSTRUCTION = `You are a data quality filter for a CRM lead intake system.
Score each lead record for data quality. Return a JSON array.

For each lead, return an object with exactly these keys:
{
  "index": <original array index as number>,
  "garbageScore": <float 0.0-1.0>,
  "garbageReason": "<short reason if score >= 0.5, else null>",
  "correctedCategory": "<hot|neutral|cold if inferrable, else use original>"
}

Scoring rules:
- 0.8+  = clearly fake, placeholder, or incoherent — DISCARD
- 0.5-0.79 = suspicious or low-quality — FLAG for review
- < 0.5 = acceptable quality — PASS

Indicators that INCREASE the garbage score:
* Fake names: "asdf", "test", "xxx", single letters, gibberish
* Dummy emails: test@test.com, fake@fake.com, aaa@bbb.com
* Impossible phone: all zeros, too short, all same digit, no country code
* Incoherent service descriptions: less than 5 real words, random chars
* Placeholders: "N/A", "none", "---", "123456", "example"

Return ONLY a raw JSON array. No markdown. No explanation.`;

    let geminiResponse;
    try {
      geminiResponse = await geminiJSON(
        SYSTEM_INSTRUCTION,
        `LEADS: ${JSON.stringify(records.slice(0, 50))}` // Safety cap: 50 records/call
      );

      // Gemini may return object wrapper — unwrap if needed
      if (!Array.isArray(geminiResponse)) {
        geminiResponse =
          geminiResponse.results ??
          geminiResponse.leads ??
          geminiResponse.scores ??
          Object.values(geminiResponse)[0];
      }
    } catch (err) {
      console.error('[filterGarbageRecords] Gemini call failed:', err.message);
      // Graceful degradation: pass all records with score=0 (no filtering)
      geminiResponse = records.map((r, i) => ({
        index: i,
        garbageScore: 0,
        garbageReason: null,
        correctedCategory: r.category ?? 'neutral',
      }));
    }

    // Merge AI scores back into records
    const enriched = records.map((record, i) => {
      const aiResult = (Array.isArray(geminiResponse) ? geminiResponse : []).find(
        (r) => r.index === i
      ) ?? {
        garbageScore: 0,
        garbageReason: null,
        correctedCategory: record.category ?? 'neutral',
      };

      const score = Number(aiResult.garbageScore) || 0;
      return {
        ...record,
        garbageScore: score,
        garbageReason: aiResult.garbageReason ?? null,
        isDiscarded: score >= 0.8,
        category: aiResult.correctedCategory ?? record.category ?? 'neutral',
      };
    });

    return { enrichedRecords: enriched };
  }
);
