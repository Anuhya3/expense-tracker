const express = require('express');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

const CATEGORIES = [
  { id: 'food', label: 'Food & Dining', icon: '🍔', color: '#f97316' },
  { id: 'transport', label: 'Transport', icon: '🚗', color: '#3b82f6' },
  { id: 'housing', label: 'Housing', icon: '🏠', color: '#8b5cf6' },
  { id: 'utilities', label: 'Utilities', icon: '💡', color: '#eab308' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', color: '#ec4899' },
  { id: 'healthcare', label: 'Healthcare', icon: '🏥', color: '#14b8a6' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️', color: '#f43f5e' },
  { id: 'education', label: 'Education', icon: '📚', color: '#6366f1' },
  { id: 'travel', label: 'Travel', icon: '✈️', color: '#0ea5e9' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📱', color: '#a855f7' },
  { id: 'other', label: 'Other', icon: '📌', color: '#64748b' }
];

// GET /api/categories
router.get('/', (req, res) => {
  res.json({ categories: CATEGORIES });
});

module.exports = router;
