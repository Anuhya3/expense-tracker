const mongoose = require('mongoose');

const CATEGORIES = [
  'food', 'transport', 'housing', 'utilities', 'entertainment',
  'healthcare', 'shopping', 'education', 'travel', 'subscriptions', 'other'
];

const sharedExpenseSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: 'GBP' },
  description: { type: String, required: true, trim: true, maxlength: 200 },
  category: { type: String, enum: CATEGORIES, default: 'other' },
  date: { type: Date, required: true, default: Date.now },
  splitType: { type: String, enum: ['equal', 'exact', 'percentage'], default: 'equal' },
  splits: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    percentage: Number,
    isPaid: { type: Boolean, default: false },
    paidAt: Date
  }]
}, { timestamps: true });

sharedExpenseSchema.index({ group: 1, date: -1 });
sharedExpenseSchema.index({ paidBy: 1 });

module.exports = mongoose.model('SharedExpense', sharedExpenseSchema);
