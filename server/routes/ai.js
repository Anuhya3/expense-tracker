const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/auth');
const { callClaude, parseJSONResponse, AI_AVAILABLE, mockCategorise } = require('../utils/ai');

const router = express.Router();

// Multer — memory storage, 5MB, images only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are accepted'));
    }
  }
});

// GET /api/ai/status — public, no auth
router.get('/status', (req, res) => {
  res.json({
    available: true,
    mode: AI_AVAILABLE ? 'live' : 'demo'
  });
});

// POST /api/ai/scan-receipt
router.post('/scan-receipt', protect, upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    if (!AI_AVAILABLE) {
      // Demo mode — return realistic mock
      const today = new Date().toISOString().split('T')[0];
      return res.json({
        success: true,
        mode: 'demo',
        data: {
          amount: 34.50,
          description: 'Tesco Express — Weekly groceries',
          category: 'food',
          date: today,
          confidence: 0.92,
          items: ['Milk 1L', 'Bread Wholemeal', 'Chicken Breast 500g', 'Bananas x5', 'Pasta Penne 500g']
        }
      });
    }

    // Live mode — call Claude with vision
    const base64 = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    const text = await callClaude({
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 }
          },
          {
            type: 'text',
            text: `Analyse this receipt image and extract the following information. Respond ONLY with a JSON object, no other text:
{
  "amount": <number — the total amount paid, as a decimal number>,
  "description": "<string — the vendor/store name and brief description of purchase>",
  "category": "<string — one of: food, transport, housing, utilities, entertainment, healthcare, shopping, education, travel, subscriptions, other>",
  "date": "<string — the date on the receipt in YYYY-MM-DD format, or null if not visible>",
  "confidence": <number — your confidence in the extraction from 0.0 to 1.0>,
  "items": [<array of strings — individual line items if visible, otherwise empty array>]
}`
          }
        ]
      }]
    });

    if (!text) throw new Error('No response from Claude');

    let data;
    try {
      data = parseJSONResponse(text);
    } catch {
      console.error('Failed to parse Claude receipt response:', text);
      return res.status(422).json({ error: 'Could not extract receipt data — the image may be unclear or not a receipt' });
    }

    res.json({ success: true, mode: 'live', data });
  } catch (err) {
    console.error('Receipt scan error:', err.message);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    }
    res.status(500).json({ error: err.message || 'Receipt scanning failed' });
  }
});

// POST /api/ai/categorise — single description
router.post('/categorise', protect, async (req, res) => {
  try {
    const { description } = req.body;
    if (!description || typeof description !== 'string' || description.trim().length < 2) {
      return res.status(400).json({ error: 'Description is required' });
    }

    if (!AI_AVAILABLE) {
      const data = mockCategorise(description);
      return res.json({ success: true, mode: 'demo', data });
    }

    const text = await callClaude({
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Categorise this expense description into exactly one category. Respond ONLY with a JSON object, no other text:

Description: "${description.trim()}"

Categories: food, transport, housing, utilities, entertainment, healthcare, shopping, education, travel, subscriptions, other

{
  "category": "<the best matching category from the list above>",
  "confidence": <number from 0.0 to 1.0>,
  "reasoning": "<one sentence explaining why>"
}`
      }]
    });

    if (!text) throw new Error('No response from Claude');

    let data;
    try {
      data = parseJSONResponse(text);
    } catch {
      console.error('Failed to parse categorise response:', text);
      data = mockCategorise(description);
    }

    res.json({ success: true, mode: 'live', data });
  } catch (err) {
    console.error('Categorise error:', err.message);
    if (err.name === 'AbortError') {
      // On timeout fall back to demo
      const data = mockCategorise(req.body.description || '');
      return res.json({ success: true, mode: 'demo', data });
    }
    res.status(500).json({ error: err.message || 'Categorisation failed' });
  }
});

// POST /api/ai/categorise-bulk
router.post('/categorise-bulk', protect, async (req, res) => {
  try {
    const { descriptions } = req.body;
    if (!Array.isArray(descriptions) || descriptions.length === 0) {
      return res.status(400).json({ error: 'descriptions must be a non-empty array' });
    }
    if (descriptions.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 descriptions per request' });
    }

    if (!AI_AVAILABLE) {
      const data = descriptions.map((desc, i) => ({
        index: i + 1,
        description: desc,
        ...mockCategorise(desc)
      }));
      return res.json({ success: true, mode: 'demo', data });
    }

    const descList = descriptions.map((d, i) => `${i + 1}. "${d}"`).join('\n');
    const text = await callClaude({
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Categorise each of these expense descriptions. Respond ONLY with a JSON array, no other text:

Descriptions:
${descList}

Categories: food, transport, housing, utilities, entertainment, healthcare, shopping, education, travel, subscriptions, other

[
  { "index": 1, "description": "...", "category": "food", "confidence": 0.95 },
  ...
]`
      }]
    });

    if (!text) throw new Error('No response from Claude');

    let data;
    try {
      data = parseJSONResponse(text);
    } catch {
      console.error('Failed to parse bulk categorise response:', text);
      // Fall back to keyword matching
      data = descriptions.map((desc, i) => ({
        index: i + 1,
        description: desc,
        ...mockCategorise(desc)
      }));
    }

    res.json({ success: true, mode: 'live', data });
  } catch (err) {
    console.error('Bulk categorise error:', err.message);
    if (err.name === 'AbortError') {
      const data = (req.body.descriptions || []).map((desc, i) => ({
        index: i + 1,
        description: desc,
        ...mockCategorise(desc)
      }));
      return res.json({ success: true, mode: 'demo', data });
    }
    res.status(500).json({ error: err.message || 'Bulk categorisation failed' });
  }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.includes('Only JPEG')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
