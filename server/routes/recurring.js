const express = require('express');
const { body, validationResult } = require('express-validator');
const RecurringExpense = require('../models/RecurringExpense');
const Expense = require('../models/Expense');
const Activity = require('../models/Activity');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/recurring
router.get('/', async (req, res) => {
  try {
    const recurring = await RecurringExpense.find({ user: req.user._id }).sort({ nextDueDate: 1 }).lean();
    res.json({ recurring });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recurring
router.post('/', [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('category').isIn([
    'food', 'transport', 'housing', 'utilities', 'entertainment',
    'healthcare', 'shopping', 'education', 'travel', 'subscriptions', 'other'
  ]).withMessage('Valid category required'),
  body('frequency').isIn(['weekly', 'monthly', 'yearly']).withMessage('Valid frequency required'),
  body('nextDueDate').isISO8601().withMessage('Valid date required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const recurring = await RecurringExpense.create({ ...req.body, user: req.user._id });
    res.status(201).json(recurring);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/recurring/:id
router.put('/:id', async (req, res) => {
  try {
    const recurring = await RecurringExpense.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!recurring) return res.status(404).json({ error: 'Recurring expense not found' });
    res.json(recurring);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/recurring/:id
router.delete('/:id', async (req, res) => {
  try {
    const recurring = await RecurringExpense.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!recurring) return res.status(404).json({ error: 'Recurring expense not found' });
    res.json({ message: 'Recurring expense deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recurring/generate — generate due expenses
router.post('/generate', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const dueTemplates = await RecurringExpense.find({
      user: req.user._id,
      isActive: true,
      nextDueDate: { $lte: today }
    });

    let generated = 0;
    for (const template of dueTemplates) {
      await Expense.create({
        user: req.user._id,
        amount: template.amount,
        description: template.description,
        category: template.category,
        paymentMethod: template.paymentMethod,
        date: template.nextDueDate,
        isRecurring: true
      });

      // Advance nextDueDate by frequency
      const next = new Date(template.nextDueDate);
      if (template.frequency === 'weekly') next.setDate(next.getDate() + 7);
      else if (template.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
      else if (template.frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);

      await RecurringExpense.findByIdAndUpdate(template._id, {
        nextDueDate: next,
        lastGenerated: new Date()
      });

      generated++;
    }

    if (generated > 0) {
      await Activity.create({
        user: req.user._id,
        action: 'recurring_generated',
        entityType: 'recurring',
        metadata: { count: generated }
      });
    }

    res.json({ generated, message: `${generated} expense${generated !== 1 ? 's' : ''} generated` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
