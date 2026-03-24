const mongoose = require('mongoose');
const { GraphQLError } = require('graphql');
const { GraphQLScalarType, Kind } = require('graphql');
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const { convert } = require('../utils/exchangeRates');

// ── Auth guard ─────────────────────────────────────────────────────────────
function requireAuth(context) {
  if (!context.user) {
    throw new GraphQLError('You must be logged in.', {
      extensions: { code: 'UNAUTHENTICATED' }
    });
  }
}

// ── Date scalar ────────────────────────────────────────────────────────────
const DateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'ISO-8601 date string or JavaScript Date object',
  serialize(value) {
    if (value instanceof Date) return value.toISOString();
    return new Date(value).toISOString();
  },
  parseValue(value) {
    return new Date(value);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return new Date(ast.value);
    if (ast.kind === Kind.INT) return new Date(parseInt(ast.value, 10));
    return null;
  }
});

// ── Shared filter builder (mirrors routes/expenses.js buildFilter) ─────────
function buildFilter(userId, { category, search, startDate, endDate } = {}) {
  const filter = { user: userId };
  if (category) filter.category = category;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }
  if (search) filter.description = { $regex: search, $options: 'i' };
  return filter;
}

// ── Expense field mapper ───────────────────────────────────────────────────
function mapExpense(doc) {
  return {
    id: doc._id.toString(),
    description: doc.description,
    amount: doc.amount,
    category: doc.category,
    date: doc.date,
    paymentMethod: doc.paymentMethod || 'debit_card',
    isRecurring: doc.isRecurring || false,
    tags: doc.tags || [],
    currency: doc.currency || 'GBP',
    originalAmount: doc.originalAmount || null,
    exchangeRate: doc.exchangeRate || null,
    userId: doc.user.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

// ── Resolvers ──────────────────────────────────────────────────────────────
const resolvers = {
  Date: DateScalar,

  Query: {
    // ── expenses ────────────────────────────────────────────────────────────
    async expenses(_, { limit = 20, offset = 0, category, search, startDate, endDate, sort }, context) {
      requireAuth(context);
      const userId = new mongoose.Types.ObjectId(context.user._id);
      const filter = buildFilter(userId, { category, search, startDate, endDate });

      const sortField = sort || '-date';
      const sortObj = sortField.startsWith('-')
        ? { [sortField.slice(1)]: -1 }
        : { [sortField]: 1 };

      const page = Math.floor(offset / limit) + 1;

      const [docs, total] = await Promise.all([
        Expense.find(filter).sort(sortObj).skip(offset).limit(limit).lean(),
        Expense.countDocuments(filter)
      ]);

      return {
        expenses: docs.map(mapExpense),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    },

    // ── expense (single) ────────────────────────────────────────────────────
    async expense(_, { id }, context) {
      requireAuth(context);
      const doc = await Expense.findOne({
        _id: id,
        user: context.user._id
      }).lean();

      if (!doc) {
        throw new GraphQLError('Expense not found.', {
          extensions: { code: 'NOT_FOUND' }
        });
      }
      return mapExpense(doc);
    },

    // ── summary ─────────────────────────────────────────────────────────────
    async summary(_, { month, year }, context) {
      requireAuth(context);
      const userId = new mongoose.Types.ObjectId(context.user._id);
      const now = new Date();
      const targetMonth = (month ?? now.getMonth() + 1) - 1; // 0-indexed
      const targetYear = year ?? now.getFullYear();

      const startOfMonth = new Date(targetYear, targetMonth, 1);
      const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

      const prevMonth = targetMonth === 0 ? 11 : targetMonth - 1;
      const prevYear = targetMonth === 0 ? targetYear - 1 : targetYear;
      const startOfLastMonth = new Date(prevYear, prevMonth, 1);
      const endOfLastMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);

      const [[current], [last]] = await Promise.all([
        Expense.aggregate([
          { $match: { user: userId, date: { $gte: startOfMonth, $lte: endOfMonth } } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 }, avg: { $avg: '$amount' } } }
        ]),
        Expense.aggregate([
          { $match: { user: userId, date: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ])
      ]);

      const currentTotal = current?.total || 0;
      const lastTotal = last?.total || 0;
      const monthOverMonthChange = lastTotal > 0
        ? +((((currentTotal - lastTotal) / lastTotal) * 100).toFixed(1))
        : 0;

      const monthlyBudget = context.user.monthlyBudget || 0;

      return {
        totalAmount: +currentTotal.toFixed(2),
        count: current?.count || 0,
        avgPerTransaction: current?.avg ? +current.avg.toFixed(2) : 0,
        month: targetMonth + 1,
        year: targetYear,
        monthOverMonthChange,
        budget: monthlyBudget,
        budgetUsed: monthlyBudget > 0 ? +((currentTotal / monthlyBudget) * 100).toFixed(1) : 0
      };
    },

    // ── expensesByCategory ───────────────────────────────────────────────────
    async expensesByCategory(_, { months = 1 }, context) {
      requireAuth(context);
      const userId = new mongoose.Types.ObjectId(context.user._id);
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const breakdown = await Expense.aggregate([
        { $match: { user: userId, date: { $gte: startDate } } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 }, avg: { $avg: '$amount' } } },
        { $sort: { total: -1 } },
        { $project: { category: '$_id', total: { $round: ['$total', 2] }, count: 1, avg: { $round: ['$avg', 2] }, _id: 0 } }
      ]);

      const grandTotal = breakdown.reduce((sum, b) => sum + b.total, 0);
      return {
        breakdown: breakdown.map(b => ({
          ...b,
          percentage: grandTotal > 0 ? +((b.total / grandTotal) * 100).toFixed(1) : 0
        })),
        total: +grandTotal.toFixed(2)
      };
    },

    // ── spendingTrend ────────────────────────────────────────────────────────
    async spendingTrend(_, { days = 30 }, context) {
      requireAuth(context);
      const userId = new mongoose.Types.ObjectId(context.user._id);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const trend = await Expense.aggregate([
        { $match: { user: userId, date: { $gte: startDate } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }},
        { $sort: { '_id': 1 } },
        { $project: { date: '$_id', total: { $round: ['$total', 2] }, count: 1, _id: 0 } }
      ]);

      return trend;
    },

    // ── budgets ──────────────────────────────────────────────────────────────
    async budgets(_, { month, year }, context) {
      requireAuth(context);
      const now = new Date();
      const targetMonth = month ?? now.getMonth() + 1;
      const targetYear = year ?? now.getFullYear();

      const userId = new mongoose.Types.ObjectId(context.user._id);

      const [budgets, spendingData] = await Promise.all([
        Budget.find({ user: context.user._id, month: targetMonth, year: targetYear }).lean(),
        Expense.aggregate([
          {
            $match: {
              user: userId,
              date: {
                $gte: new Date(targetYear, targetMonth - 1, 1),
                $lte: new Date(targetYear, targetMonth, 0, 23, 59, 59, 999)
              }
            }
          },
          { $group: { _id: '$category', spent: { $sum: '$amount' } } }
        ])
      ]);

      const spentMap = {};
      spendingData.forEach(s => { spentMap[s._id] = s.spent; });

      return budgets.map(b => {
        const spent = spentMap[b.category] || 0;
        return {
          id: b._id.toString(),
          category: b.category,
          limit: b.limit,
          month: b.month,
          year: b.year,
          spent: +spent.toFixed(2),
          remaining: +(b.limit - spent).toFixed(2),
          percentUsed: b.limit > 0 ? +((spent / b.limit) * 100).toFixed(1) : 0
        };
      });
    }
  },

  Mutation: {
    // ── createExpense ────────────────────────────────────────────────────────
    async createExpense(_, { input }, context) {
      requireAuth(context);
      const baseCurrency = context.user.currency || 'GBP';
      const currency = (input.currency || baseCurrency).toUpperCase();

      let amount = input.amount;
      let originalAmount = amount;
      let exchangeRate = 1;

      if (currency !== baseCurrency) {
        try {
          const result = await convert(amount, currency, baseCurrency);
          amount = result.convertedAmount;
          exchangeRate = result.rate;
        } catch {
          // If conversion fails keep original amount
        }
      }

      const expense = await Expense.create({
        user: context.user._id,
        description: input.description,
        amount,
        category: input.category,
        date: input.date || new Date(),
        paymentMethod: input.paymentMethod || 'debit_card',
        isRecurring: input.isRecurring || false,
        tags: input.tags || [],
        splits: input.splits || [],
        currency,
        originalAmount,
        exchangeRate
      });

      return mapExpense(expense.toObject());
    },

    // ── updateExpense ────────────────────────────────────────────────────────
    async updateExpense(_, { id, input }, context) {
      requireAuth(context);
      const existing = await Expense.findOne({ _id: id, user: context.user._id });
      if (!existing) {
        throw new GraphQLError('Expense not found or access denied.', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      const baseCurrency = context.user.currency || 'GBP';
      const currency = (input.currency || existing.currency || baseCurrency).toUpperCase();

      let amount = input.amount ?? existing.amount;
      let originalAmount = amount;
      let exchangeRate = 1;

      if (currency !== baseCurrency) {
        try {
          const result = await convert(amount, currency, baseCurrency);
          amount = result.convertedAmount;
          exchangeRate = result.rate;
        } catch {
          // keep original
        }
      }

      const updates = {
        ...(input.description !== undefined && { description: input.description }),
        amount,
        originalAmount,
        exchangeRate,
        currency,
        ...(input.category !== undefined && { category: input.category }),
        ...(input.date !== undefined && { date: input.date }),
        ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod }),
        ...(input.isRecurring !== undefined && { isRecurring: input.isRecurring }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.splits !== undefined && { splits: input.splits })
      };

      const updated = await Expense.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).lean();
      return mapExpense(updated);
    },

    // ── deleteExpense ────────────────────────────────────────────────────────
    async deleteExpense(_, { id }, context) {
      requireAuth(context);
      const result = await Expense.findOneAndDelete({ _id: id, user: context.user._id });
      if (!result) {
        throw new GraphQLError('Expense not found or access denied.', {
          extensions: { code: 'NOT_FOUND' }
        });
      }
      return { success: true, message: `Expense "${result.description}" deleted.` };
    },

    // ── upsertBudget ─────────────────────────────────────────────────────────
    async upsertBudget(_, { input }, context) {
      requireAuth(context);
      const { category, limit, month, year } = input;

      const budget = await Budget.findOneAndUpdate(
        { user: context.user._id, category, month, year },
        { limit },
        { upsert: true, new: true, runValidators: true }
      ).lean();

      return {
        id: budget._id.toString(),
        category: budget.category,
        limit: budget.limit,
        month: budget.month,
        year: budget.year,
        spent: null,
        remaining: null,
        percentUsed: null
      };
    }
  }
};

module.exports = resolvers;
