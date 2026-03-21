const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: [
      'expense_created', 'expense_updated', 'expense_deleted',
      'budget_set', 'budget_exceeded', 'recurring_generated', 'login'
    ],
    required: true
  },
  entityType: {
    type: String,
    enum: ['expense', 'budget', 'recurring', 'auth'],
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

activitySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
