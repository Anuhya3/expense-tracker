const express = require('express');
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const RecurringExpense = require('../models/RecurringExpense');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/analytics/summary
router.get('/summary', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [[currentMonth], [lastMonth], [today]] = await Promise.all([
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 }, avg: { $avg: '$amount' } } }
      ]),
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ])
    ]);

    const currentTotal = currentMonth?.total || 0;
    const lastTotal = lastMonth?.total || 0;
    const monthOverMonthChange = lastTotal > 0
      ? (((currentTotal - lastTotal) / lastTotal) * 100).toFixed(1)
      : 0;

    res.json({
      currentMonth: {
        total: currentTotal,
        count: currentMonth?.count || 0,
        avgPerTransaction: currentMonth?.avg ? +currentMonth.avg.toFixed(2) : 0,
        budget: req.user.monthlyBudget,
        budgetUsed: req.user.monthlyBudget > 0
          ? +((currentTotal / req.user.monthlyBudget) * 100).toFixed(1)
          : 0
      },
      lastMonth: { total: lastTotal, count: lastMonth?.count || 0 },
      today: { total: today?.total || 0, count: today?.count || 0 },
      monthOverMonthChange: +monthOverMonthChange
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/by-category
router.get('/by-category', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const months = parseInt(req.query.months) || 1;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const breakdown = await Expense.aggregate([
      { $match: { user: userId, date: { $gte: startDate } } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 }, avg: { $avg: '$amount' } } },
      { $sort: { total: -1 } },
      { $project: { category: '$_id', total: { $round: ['$total', 2] }, count: 1, avg: { $round: ['$avg', 2] }, _id: 0 } }
    ]);

    const grandTotal = breakdown.reduce((sum, b) => sum + b.total, 0);
    const withPercentage = breakdown.map(b => ({
      ...b,
      percentage: grandTotal > 0 ? +((b.total / grandTotal) * 100).toFixed(1) : 0
    }));

    res.json({ breakdown: withPercentage, total: +grandTotal.toFixed(2) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/trends
router.get('/trends', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trends = await Expense.aggregate([
      { $match: { user: userId, date: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } },
      { $project: { date: '$_id', total: { $round: ['$total', 2] }, count: 1, _id: 0 } }
    ]);

    res.json({ trends, days });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/monthly
router.get('/monthly', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const monthly = await Expense.aggregate([
      { $match: { user: userId, date: { $gte: startDate, $lt: endDate } } },
      { $group: { _id: { $month: '$date' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } },
      { $project: { month: '$_id', total: { $round: ['$total', 2] }, count: 1, _id: 0 } }
    ]);

    res.json({ monthly, year });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/budget-status
router.get('/budget-status', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const [budgets, spending] = await Promise.all([
      Budget.find({ user: req.user._id, month, year }).lean(),
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: '$category', spent: { $sum: '$amount' } } }
      ])
    ]);

    const spendingMap = {};
    spending.forEach(s => { spendingMap[s._id] = s.spent; });

    const status = budgets.map(b => ({
      category: b.category,
      limit: b.limit,
      spent: +(spendingMap[b.category] || 0).toFixed(2),
      remaining: +(b.limit - (spendingMap[b.category] || 0)).toFixed(2),
      percentUsed: +((((spendingMap[b.category] || 0) / b.limit) * 100)).toFixed(1),
      isOverBudget: (spendingMap[b.category] || 0) > b.limit
    }));

    res.json({ budgetStatus: status, month, year });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/by-tag
router.get('/by-tag', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const months = parseInt(req.query.months) || 1;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const breakdown = await Expense.aggregate([
      { $match: { user: userId, date: { $gte: startDate }, tags: { $exists: true, $ne: [] } } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $project: { tag: '$_id', total: { $round: ['$total', 2] }, count: 1, _id: 0 } }
    ]);

    const grandTotal = breakdown.reduce((s, b) => s + b.total, 0);
    const withPct = breakdown.map(b => ({
      ...b,
      percentage: grandTotal > 0 ? +((b.total / grandTotal) * 100).toFixed(1) : 0
    }));

    res.json({ breakdown: withPct, total: +grandTotal.toFixed(2) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/insights
router.get('/insights', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const insights = [];

    // Fetch data in parallel
    const [budgets, currentSpending, lastMonthSpending, weeklySpending, allMonthExpenses, recurring] = await Promise.all([
      Budget.find({ user: req.user._id, month: now.getMonth() + 1, year: now.getFullYear() }).lean(),
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: startOfMonth } } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } }
      ]),
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: startOfWeek } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Expense.find({ user: userId, date: { $gte: startOfMonth } }).lean(),
      RecurringExpense.find({ user: req.user._id, isActive: true }).lean()
    ]);

    const currentMap = {};
    currentSpending.forEach(s => { currentMap[s._id] = s.total; });
    const lastMap = {};
    lastMonthSpending.forEach(s => { lastMap[s._id] = s.total; });

    const monthTotal = Object.values(currentMap).reduce((a, b) => a + b, 0);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = now.getDate();
    const dailyAvg = monthTotal / (daysPassed || 1);
    const weeklyTotal = weeklySpending[0]?.total || 0;
    const weeklyAvg = dailyAvg * 7;

    // 1. Overspend alert
    budgets.forEach(b => {
      const spent = currentMap[b.category] || 0;
      if (spent > b.limit) {
        insights.push({
          type: 'warning',
          title: `${b.category.charAt(0).toUpperCase() + b.category.slice(1)} over budget`,
          message: `You've spent £${spent.toFixed(2)} of your £${b.limit} ${b.category} budget this month.`,
          icon: 'alert-triangle'
        });
      }
    });

    // 2. Spending spike this week
    if (weeklyAvg > 0 && weeklyTotal > weeklyAvg * 1.5) {
      insights.push({
        type: 'warning',
        title: 'Spending spike this week',
        message: `This week's spending (£${weeklyTotal.toFixed(2)}) is ${Math.round((weeklyTotal / weeklyAvg - 1) * 100)}% above your weekly average.`,
        icon: 'trending-up'
      });
    }

    // 3. Savings opportunity — category dropped >20% MoM
    Object.entries(lastMap).forEach(([cat, lastAmt]) => {
      const currAmt = currentMap[cat] || 0;
      // Normalize to per-day for fair comparison
      const lastDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      const lastDaily = lastAmt / lastDays;
      const currDaily = currAmt / daysPassed;
      if (lastDaily > 0 && currDaily < lastDaily * 0.8) {
        insights.push({
          type: 'success',
          title: `Saving on ${cat}`,
          message: `Your ${cat} spending is down ${Math.round((1 - currDaily / lastDaily) * 100)}% compared to last month. Keep it up!`,
          icon: 'trending-down'
        });
      }
    });

    // 4. Recurring burden
    if (recurring.length > 0 && monthTotal > 0) {
      const recurringMonthly = recurring.reduce((s, r) => {
        if (r.frequency === 'weekly') return s + r.amount * 4.33;
        if (r.frequency === 'yearly') return s + r.amount / 12;
        return s + r.amount;
      }, 0);
      if (recurringMonthly / monthTotal > 0.4) {
        insights.push({
          type: 'info',
          title: 'High recurring costs',
          message: `Recurring expenses make up ${Math.round((recurringMonthly / monthTotal) * 100)}% of your monthly spending (£${recurringMonthly.toFixed(2)}/mo).`,
          icon: 'repeat'
        });
      }
    }

    // 5. Top category shift
    const topCurrent = Object.entries(currentMap).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topLast = Object.entries(lastMap).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (topCurrent && topLast && topCurrent !== topLast) {
      insights.push({
        type: 'info',
        title: 'Top spending category shifted',
        message: `${topCurrent.charAt(0).toUpperCase() + topCurrent.slice(1)} is now your top category, up from ${topLast} last month.`,
        icon: 'bar-chart-2'
      });
    }

    // 6. Budget on track
    const totalBudget = budgets.reduce((s, b) => s + b.limit, 0);
    if (totalBudget > 0 && daysPassed / daysInMonth > 0.5 && monthTotal / totalBudget < 0.8) {
      insights.push({
        type: 'success',
        title: 'On track with budget',
        message: `You've used ${Math.round((monthTotal / totalBudget) * 100)}% of category budgets with ${daysInMonth - daysPassed} days left in the month.`,
        icon: 'check-circle'
      });
    }

    // 7. Unusual transaction
    if (allMonthExpenses.length > 3) {
      const avg = monthTotal / allMonthExpenses.length;
      const largest = allMonthExpenses.reduce((m, e) => e.amount > m.amount ? e : m, allMonthExpenses[0]);
      if (largest.amount > avg * 3) {
        insights.push({
          type: 'info',
          title: 'Unusual transaction',
          message: `"${largest.description}" (£${largest.amount.toFixed(2)}) is ${Math.round(largest.amount / avg)}× your average transaction this month.`,
          icon: 'zap'
        });
      }
    }

    // Sort: warnings first, then info, then success. Cap at 5.
    const sorted = insights.sort((a, b) => {
      const order = { warning: 0, info: 1, success: 2 };
      return order[a.type] - order[b.type];
    }).slice(0, 5);

    res.json({ insights: sorted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
