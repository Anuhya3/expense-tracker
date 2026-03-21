const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  paidTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: 'GBP' },
  note: { type: String, trim: true, maxlength: 300 }
}, { timestamps: true });

settlementSchema.index({ group: 1 });

module.exports = mongoose.model('Settlement', settlementSchema);
