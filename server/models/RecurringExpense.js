const mongoose = require('mongoose');

const recurringExpenseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be positive']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: 200
  },
  category: {
    type: String,
    required: true,
    enum: [
      'food', 'transport', 'housing', 'utilities',
      'entertainment', 'healthcare', 'shopping',
      'education', 'travel', 'subscriptions', 'other'
    ]
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'other'],
    default: 'debit_card'
  },
  frequency: {
    type: String,
    enum: ['weekly', 'monthly', 'yearly'],
    required: [true, 'Frequency is required']
  },
  nextDueDate: {
    type: Date,
    required: [true, 'Next due date is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastGenerated: {
    type: Date
  }
}, {
  timestamps: true
});

recurringExpenseSchema.index({ user: 1, isActive: 1, nextDueDate: 1 });

module.exports = mongoose.model('RecurringExpense', recurringExpenseSchema);
