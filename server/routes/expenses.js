const express = require('express');
const { body, query, validationResult } = require('express-validator');
const PDFDocument = require('pdfkit');
const Expense = require('../models/Expense');
const Activity = require('../models/Activity');
const { protect } = require('../middleware/auth');
const { convert } = require('../utils/exchangeRates');
const { invalidateUserCache } = require('../middleware/cache');

const router = express.Router();
router.use(protect);

// Build shared filter from query params
function buildFilter(userId, q) {
  const filter = { user: userId };
  if (q.category) filter.category = q.category;
  if (q.startDate || q.endDate) {
    filter.date = {};
    if (q.startDate) filter.date.$gte = new Date(q.startDate);
    if (q.endDate) filter.date.$lte = new Date(q.endDate);
  }
  if (q.search) filter.description = { $regex: q.search, $options: 'i' };
  return filter;
}

// GET /api/expenses — paginated, filterable, sortable
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('sort').optional().isString()
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = buildFilter(req.user._id, req.query);

    const sortField = req.query.sort || '-date';
    const sort = sortField.startsWith('-')
      ? { [sortField.slice(1)]: -1 }
      : { [sortField]: 1 };

    const [expenses, total] = await Promise.all([
      Expense.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Expense.countDocuments(filter)
    ]);

    res.json({
      expenses,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/tags — unique tags for user
router.get('/tags', async (req, res) => {
  try {
    const tags = await Expense.aggregate([
      { $match: { user: req.user._id, tags: { $exists: true, $ne: [] } } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags' } },
      { $sort: { _id: 1 } },
      { $project: { tag: '$_id', _id: 0 } }
    ]);
    res.json({ tags: tags.map(t => t.tag) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/export/csv
router.get('/export/csv', async (req, res) => {
  try {
    const filter = buildFilter(req.user._id, req.query);
    const expenses = await Expense.find(filter).sort({ date: -1 }).lean();

    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=expenses-${today}.csv`);

    const header = 'Date,Description,Category,Amount,Payment Method,Recurring\n';
    const rows = expenses.map(e => {
      const date = new Date(e.date).toISOString().split('T')[0];
      const desc = `"${(e.description || '').replace(/"/g, '""')}"`;
      const cat = e.category || '';
      const amt = e.amount.toFixed(2);
      const pm = (e.paymentMethod || '').replace(/_/g, ' ');
      const rec = e.isRecurring ? 'Yes' : 'No';
      return `${date},${desc},${cat},${amt},${pm},${rec}`;
    }).join('\n');

    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/export/pdf
router.get('/export/pdf', async (req, res) => {
  try {
    const filter = buildFilter(req.user._id, req.query);
    const expenses = await Expense.find(filter).sort({ date: -1 }).lean();

    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const topCatMap = {};
    expenses.forEach(e => { topCatMap[e.category] = (topCatMap[e.category] || 0) + e.amount; });
    const topCat = Object.entries(topCatMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const dateFrom = req.query.startDate || (expenses.at(-1) ? new Date(expenses.at(-1).date).toISOString().split('T')[0] : '—');
    const dateTo = req.query.endDate || new Date().toISOString().split('T')[0];

    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=expenses-${dateTo}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(22).font('Helvetica-Bold').text('Expense Report', { align: 'left' });
    doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
      .text(`Period: ${dateFrom} → ${dateTo}`, { align: 'left' });
    doc.moveDown(0.5);
    doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.8);

    // Summary
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Summary');
    doc.moveDown(0.4);
    const summaryItems = [
      ['Total Spent', `£${total.toFixed(2)}`],
      ['Transactions', String(expenses.length)],
      ['Top Category', topCat.charAt(0).toUpperCase() + topCat.slice(1)]
    ];
    summaryItems.forEach(([label, value]) => {
      doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text(label, { continued: true, width: 150 });
      doc.font('Helvetica-Bold').fillColor('#111827').text(value);
    });
    doc.moveDown(0.8);
    doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.8);

    // Table header
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#6b7280');
    const cols = { date: 48, desc: 120, cat: 290, pm: 390, amt: 490 };
    doc.text('DATE', cols.date, doc.y, { width: 70 });
    doc.text('DESCRIPTION', cols.desc, doc.y - doc.currentLineHeight(), { width: 165 });
    doc.text('CATEGORY', cols.cat, doc.y - doc.currentLineHeight(), { width: 95 });
    doc.text('METHOD', cols.pm, doc.y - doc.currentLineHeight(), { width: 90 });
    doc.text('AMOUNT', cols.amt, doc.y - doc.currentLineHeight(), { width: 60, align: 'right' });
    doc.moveDown(0.3);
    doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.4);

    // Table rows
    expenses.slice(0, 200).forEach((e, i) => {
      if (doc.y > 720) { doc.addPage(); }
      const rowY = doc.y;
      const bg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
      doc.rect(48, rowY - 2, 499, 16).fill(bg);

      const dateStr = new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
      const desc = (e.description || '').substring(0, 28);
      const cat = (e.category || '').replace(/^\w/, c => c.toUpperCase());
      const pm = (e.paymentMethod || '').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
      const amt = `£${e.amount.toFixed(2)}`;

      doc.fontSize(9).font('Helvetica').fillColor('#374151');
      doc.text(dateStr, cols.date, rowY, { width: 70 });
      doc.text(desc, cols.desc, rowY, { width: 165 });
      doc.text(cat, cols.cat, rowY, { width: 95 });
      doc.text(pm, cols.pm, rowY, { width: 90 });
      doc.font('Helvetica-Bold').text(amt, cols.amt, rowY, { width: 60, align: 'right' });
      doc.moveDown(0.1);
    });

    // Footer
    doc.moveDown(1);
    doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica').fillColor('#9ca3af')
      .text(`Generated on ${new Date().toLocaleString('en-GB')} · ExpenseFlow`, { align: 'center' });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/:id
router.get('/:id', async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user._id });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses
router.post('/', [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('category').isIn([
    'food', 'transport', 'housing', 'utilities', 'entertainment',
    'healthcare', 'shopping', 'education', 'travel', 'subscriptions', 'other'
  ]).withMessage('Valid category required'),
  body('date').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const baseCurrency = req.user.currency || 'GBP';
    const reqCurrency = (req.body.currency || baseCurrency).toUpperCase();
    let amount = parseFloat(req.body.amount);
    let originalAmount = amount;
    let exchangeRate = 1;

    if (reqCurrency !== baseCurrency) {
      try {
        const result = await convert(amount, reqCurrency, baseCurrency);
        originalAmount = amount;
        amount = result.convertedAmount;
        exchangeRate = result.rate;
      } catch (convErr) {
        console.warn('Currency conversion failed:', convErr.message);
      }
    }

    const expenseData = {
      ...req.body,
      user: req.user._id,
      amount,
      currency: reqCurrency,
      originalAmount,
      exchangeRate
    };

    const expense = await Expense.create(expenseData);

    // Invalidate analytics cache so dashboard reflects the new expense
    invalidateUserCache(req.user._id.toString()).catch(() => {});

    Activity.create({
      user: req.user._id,
      action: 'expense_created',
      entityType: 'expense',
      entityId: expense._id,
      metadata: { amount: expense.amount, description: expense.description, category: expense.category }
    }).catch(() => {});

    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id
router.put('/:id', async (req, res) => {
  try {
    const baseCurrency = req.user.currency || 'GBP';
    const reqCurrency = req.body.currency ? req.body.currency.toUpperCase() : baseCurrency;
    let updateData = { ...req.body };

    if (req.body.amount !== undefined) {
      let amount = parseFloat(req.body.amount);
      let originalAmount = amount;
      let exchangeRate = 1;

      if (reqCurrency !== baseCurrency) {
        try {
          const result = await convert(amount, reqCurrency, baseCurrency);
          originalAmount = amount;
          amount = result.convertedAmount;
          exchangeRate = result.rate;
        } catch (convErr) {
          console.warn('Currency conversion failed:', convErr.message);
        }
      }

      updateData = {
        ...updateData,
        amount,
        currency: reqCurrency,
        originalAmount,
        exchangeRate
      };
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updateData,
      { new: true, runValidators: true }
    );
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    // Invalidate analytics cache so dashboard reflects the update
    invalidateUserCache(req.user._id.toString()).catch(() => {});

    Activity.create({
      user: req.user._id,
      action: 'expense_updated',
      entityType: 'expense',
      entityId: expense._id,
      metadata: { amount: expense.amount, description: expense.description, category: expense.category }
    }).catch(() => {});

    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    // Invalidate analytics cache so dashboard reflects the deletion
    invalidateUserCache(req.user._id.toString()).catch(() => {});

    Activity.create({
      user: req.user._id,
      action: 'expense_deleted',
      entityType: 'expense',
      entityId: expense._id,
      metadata: { amount: expense.amount, description: expense.description, category: expense.category }
    }).catch(() => {});

    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
