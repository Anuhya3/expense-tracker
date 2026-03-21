const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 300 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'invited', 'left'], default: 'active' }
  }],
  currency: { type: String, default: 'GBP' },
  isSettled: { type: Boolean, default: false }
}, { timestamps: true });

groupSchema.index({ 'members.user': 1 });
groupSchema.index({ owner: 1 });

module.exports = mongoose.model('Group', groupSchema);
