const { onCall, HttpsError } = require('firebase-functions/v2/https');
const axios = require('axios');
const cheerio = require('cheerio');
const OpenAI = require('openai');

// Target paths to crawl — add or remove based on common page patterns
const TARGET_PATHS = ['/', '/about', '/services', '/pricing', '/faq', '/faqs',
                      '/contact', '/team', '/products'];

const NORMALIZATION_PROMPT = `
You are a business intelligence analyst. I will provide raw text scraped
from a company website. Your task is to:

1. Extract: company name, core services/products, pricing tiers (if any),
   minimum engagement value, target clients, and key differentiators.
2. Generate a Master AI System Prompt for a voice AI receptionist.
   The prompt must include:
   - Role definition ("You are the AI receptionist for [Company Name].")
   - Services the company offers (concise list)
   - Minimum budget the AI should qualify for
   - Tone and communication style
   - What to do when a lead is qualified (signal intent_to_buy=true)
   - What to do when a lead is unqualified (politely end the call)

Return ONLY the final system prompt text. No preamble. No JSON wrapper.
`;

exports.crawlAndGeneratePrompt = onCall(
  {
    timeoutSeconds: 300,
    memory:         '512MiB',
    cors:           true,
    secrets:        ['GROQ_API_KEY'],  // Groq: generous free tier — 14,400 req/day, Llama 3.3 70B
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Not authenticated.');

    const { url } = request.data;

    // ── 1. Axios & Cheerio crawl ───────────────────────────────────────────
    let rawContent = '';
    const baseUrl = new URL(url).origin;

    for (const path of TARGET_PATHS) {
      try {
        const response = await axios.get(`${baseUrl}${path}`, {
          timeout: 10000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CRMSaaSCrawler/1.0)' }
        });
        
        const $ = cheerio.load(response.data);
        
        // Remove unwanted elements
        $('script, style, nav, footer, header, noscript, iframe').remove();
        
        const text = $('body').text().replace(/\\s{3,}/g, '\\n\\n').trim();
        if (text.length > 50) {
          rawContent += `\\n\\n## PAGE: ${path}\\n\\n${text}`;
        }
      } catch (err) {
        // AGENT NOTE: Individual page failures are non-fatal — skip and continue
      }
    }

    if (!rawContent.trim()) {
      throw new HttpsError('not-found', 'Could not extract content from the provided URL.');
    }

    // ── 2. LLM normalization ───────────────────────────────────────────────
    // Using Groq which offers generous free limits and is OpenAI-compatible
    const openai = new OpenAI({ 
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1"
    });
    
    const completion = await openai.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: NORMALIZATION_PROMPT },
        { role: 'user',   content: rawContent.slice(0, 15000) },
      ],
      temperature: 0.3,
    });

    const systemPrompt = completion.choices[0].message.content.trim();
    return { systemPrompt };
  }
);
