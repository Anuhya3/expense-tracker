const CLAUDE_AVAILABLE = !!process.env.ANTHROPIC_API_KEY;
const GEMINI_AVAILABLE = !!process.env.GEMINI_API_KEY;
const AI_AVAILABLE = CLAUDE_AVAILABLE || GEMINI_AVAILABLE;

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

// Google Gemini — free-tier vision + text model. Preferred provider when configured.
async function callGemini({ prompt, image, max_tokens = 500 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

try {
  const parts = [{ text: prompt }];
  if (image) {
    parts.push({ inline_data: { mime_type: image.mediaType, data: image.base64 } });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: max_tokens }
      }),
      signal: controller.signal
    }
    );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
} finally {
  clearTimeout(timeout);
}
}

// Anthropic Claude — original provider, kept as a fallback if ANTHROPIC_API_KEY is set.
async function callClaude({ messages, max_tokens = 500 }) {
  if (!CLAUDE_AVAILABLE) return null; // signals caller to use mock

const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens,
      messages
    }),
    signal: controller.signal
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Claude API error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.content[0]?.text || null;
} finally {
  clearTimeout(timeout);
}
}

// Unified entry point used by routes/ai.js.
// Prefers Gemini (free tier) when GEMINI_API_KEY is set, falls back to Claude if
// ANTHROPIC_API_KEY is set instead, and returns null (triggering mock/demo mode)
// if neither key is configured.
async function callAI({ prompt, image, max_tokens = 500 }) {
  if (GEMINI_AVAILABLE) {
    return callGemini({ prompt, image, max_tokens });
  }

if (CLAUDE_AVAILABLE) {
  const content = image
  ? [
    { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
    { type: 'text', text: prompt }
    ]
    : prompt;

  return callClaude({ messages: [{ role: 'user', content }], max_tokens });
}

return null;
}

function parseJSONResponse(text) {
  // Strip markdown code fences if present
const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

// Keyword-based mock categoriser for demo mode
const KEYWORD_MAP = {
  food: ['tesco', 'sainsbury', 'asda', 'aldi', 'lidl', 'morrisons', 'waitrose', 'pret', 'costa', 'starbucks', 'mcdonalds', 'nandos', 'deliveroo', 'uber eats', 'just eat', 'grocery', 'restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'breakfast', 'pizza', 'burger'],
  transport: ['uber', 'bolt', 'taxi', 'train', 'bus', 'oyster', 'tfl', 'petrol', 'fuel', 'parking', 'congestion', 'flight', 'airline', 'travelcard'],
  housing: ['rent', 'mortgage', 'landlord', 'estate agent', 'council tax', 'home insurance', 'contents insurance'],
  utilities: ['electric', 'gas', 'water', 'internet', 'broadband', 'phone bill', 'mobile bill', 'bt', 'vodafone', 'ee', 'three'],
  entertainment: ['netflix', 'spotify', 'cinema', 'theatre', 'concert', 'gig', 'game', 'playstation', 'xbox', 'steam', 'disney'],
  healthcare: ['pharmacy', 'boots', 'doctor', 'dentist', 'optician', 'gym', 'prescription', 'vitamin', 'health'],
  shopping: ['amazon', 'ebay', 'asos', 'zara', 'h&m', 'primark', 'john lewis', 'argos', 'ikea', 'clothes', 'shoes', 'gift'],
  education: ['udemy', 'coursera', 'book', 'textbook', 'course', 'conference', 'workshop', 'oreilly', 'pluralsight'],
  travel: ['airbnb', 'booking.com', 'hotel', 'hostel', 'travel insurance', 'luggage', 'visa'],
  subscriptions: ['subscription', 'monthly', 'annual plan', 'chatgpt', 'github', 'notion', 'icloud', 'google one', 'apple', 'medium']
};

const CATEGORY_REASONS = {
  food: 'Matches a food retailer or dining keyword.',
  transport: 'Matches a transport or travel service keyword.',
  housing: 'Matches a housing or rental keyword.',
  utilities: 'Matches a utilities or bills keyword.',
  entertainment: 'Matches an entertainment service keyword.',
  healthcare: 'Matches a health or medical keyword.',
  shopping: 'Matches a retail or shopping keyword.',
  education: 'Matches an education or learning keyword.',
  travel: 'Matches a travel or accommodation keyword.',
  subscriptions: 'Matches a subscription service keyword.',
  other: 'No specific keyword matched; classified as other.'
};

function mockCategorise(description) {
  const lower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return { category, confidence: 0.85, reasoning: CATEGORY_REASONS[category] };
    }
  }
  return { category: 'other', confidence: 0.3, reasoning: CATEGORY_REASONS.other };
}

module.exports = { callAI, parseJSONResponse, AI_AVAILABLE, mockCategorise };
