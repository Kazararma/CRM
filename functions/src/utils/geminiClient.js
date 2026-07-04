/**
 * geminiClient.js — Shared Google Gemini AI utility
 *
 * Model: gemini-2.0-flash
 * Free tier: 15 RPM · 1,500 req/day · 1M tokens/min
 * No billing required for free tier usage.
 *
 * Usage:
 *   const { geminiJSON, geminiText } = require('./utils/geminiClient');
 *
 *   // Returns parsed JSON object
 *   const result = await geminiJSON(systemPrompt, userMessage);
 *
 *   // Returns plain text string
 *   const text = await geminiText(systemPrompt, userMessage);
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL_NAME = 'gemini-2.0-flash';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY secret is not set.');
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Call Gemini and return a parsed JSON object.
 * Gemini natively supports JSON output mode — no post-processing regex needed.
 *
 * @param {string} systemInstruction - The system-level instruction
 * @param {string} userMessage       - The user message / data payload
 * @param {number} [temperature=0.1] - Sampling temperature (low = deterministic)
 * @returns {Promise<object>}        - Parsed JSON response
 */
async function geminiJSON(systemInstruction, userMessage, temperature = 0.1) {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature,
    },
  });

  const result = await model.generateContent(userMessage);
  const text = result.response.text().trim();

  try {
    return JSON.parse(text);
  } catch {
    // Strip markdown fences if present (safety fallback)
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    return JSON.parse(cleaned);
  }
}

/**
 * Call Gemini and return a plain text string.
 *
 * @param {string} systemInstruction
 * @param {string} userMessage
 * @param {number} [temperature=0.3]
 * @returns {Promise<string>}
 */
async function geminiText(systemInstruction, userMessage, temperature = 0.3) {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction,
    generationConfig: { temperature },
  });

  const result = await model.generateContent(userMessage);
  return result.response.text().trim();
}

module.exports = { geminiJSON, geminiText, MODEL_NAME };
