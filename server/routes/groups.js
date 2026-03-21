const express = require('express');
const mongoose = require('mongoose');
const Group = require('../models/Group');
const SharedExpense = require('../models/SharedExpense');
const Settlement = require('../models/Settlement');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Helper: get member role or null
function getMemberRole(group, userId) {
  const id = userId.toString();
  const member = group.members.find(m => m.user.toString() === id || (m.user._id && m.user._id.toString() === id));
  if (!member) return null;
  return member.role;
}

function getMemberStatus(group, userId) {
  const id = userId.toString();
  const member = group.members.find(m => m.user.toString() === id || (m.user._id && m.user._id.toString() === id));
  if (!member) return null;
  return member.status;
}

function isMember(group, userId) {
  const id = userId.toString();
  return group.members.some(m => {
    const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
    return memberId === id;
  });
}

function isOwnerOrAdmin(group, userId) {
  const id = userId.toString();
  const member = group.members.find(m => {
    const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
    return memberId === id;
  });
  return member && (member.role === 'owner' || member.role === 'admin');
}

// POST /api/groups — create group
router.post('/', async (req, res) => {
  try {
    const { name, description, currency } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Group name is required' });

    const group = await Group.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      owner: req.user._id,
      currency: currency || 'GBP',
      members: [{
        user: req.user._id,
        role: 'owner',
        status: 'active',
        joinedAt: new Date()
      }]
    });

    const populated = await Group.findById(group._id)
      .populate('members.user', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups — list groups where user is a member
router.get('/', async (req, res) => {
  try {
    const groups = await Group.find({ 'members.user': req.user._id })
      .populate('members.user', 'name email')
      .sort({ updatedAt: -1 });
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id — get group detail
router.get('/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members.user', 'name email');
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isMember(group, req.user._id)) return res.status(403).json({ error: 'Access denied' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/groups/:id — update name/description
router.put('/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('members.user', 'name email');
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isOwnerOrAdmin(group, req.user._id)) return res.status(403).json({ error: 'Only owner or admin can update group' });

    const { name, description } = req.body;
    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    await group.save();

    const populated = await Group.findById(group._id).populate('members.user', 'name email');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/groups/:id — delete group
router.delete('/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the owner can delete this group' });
    }

    await Promise.all([
      SharedExpense.deleteMany({ group: group._id }),
      Settlement.deleteMany({ group: group._id }),
      Group.findByIdAndDelete(group._id)
    ]);

    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:id/members — invite by email
router.post('/:id/members', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('members.user', 'name email');
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isOwnerOrAdmin(group, req.user._id)) return res.status(403).json({ error: 'Only owner or admin can invite members' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const invitedUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (!invitedUser) return res.status(404).json({ error: 'User not found with that email' });

    const alreadyMember = group.members.some(m => {
      const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
      return memberId === invitedUser._id.toString();
    });
    if (alreadyMember) return res.status(400).json({ error: 'User is already a member of this group' });

    group.members.push({
      user: invitedUser._id,
      role: 'member',
      status: 'invited',
      joinedAt: new Date()
    });
    await group.save();

    const populated = await Group.findById(group._id).populate('members.user', 'name email');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/groups/:id/members/:userId/accept — accept invite
router.put('/:id/members/:userId/accept', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only accept your own invitation' });
    }

    const member = group.members.find(m => m.user.toString() === req.user._id.toString());
    if (!member) return res.status(404).json({ error: 'Invitation not found' });
    if (member.status !== 'invited') return res.status(400).json({ error: 'No pending invitation' });

    member.status = 'active';
    await group.save();

    const populated = await Group.findById(group._id).populate('members.user', 'name email');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/groups/:id/members/:userId/remove — remove member
router.put('/:id/members/:userId/remove', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('members.user', 'name email');
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const targetId = req.params.userId;
    const isSelf = targetId === req.user._id.toString();
    const canRemove = isSelf || isOwnerOrAdmin(group, req.user._id);
    if (!canRemove) return res.status(403).json({ error: 'Not authorized to remove this member' });

    const memberIndex = group.members.findIndex(m => {
      const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
      return memberId === targetId;
    });
    if (memberIndex === -1) return res.status(404).json({ error: 'Member not found' });

    group.members[memberIndex].status = 'left';
    await group.save();

    const populated = await Group.findById(group._id).populate('members.user', 'name email');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:id/expenses — add shared expense
router.post('/:id/expenses', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('members.user', 'name email');
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isMember(group, req.user._id)) return res.status(403).json({ error: 'Access denied' });

    const { amount, description, category, date, splitType, splits: inputSplits, currency } = req.body;

    if (!amount || amount < 0.01) return res.status(400).json({ error: 'Valid amount is required' });
    if (!description) return res.status(400).json({ error: 'Description is required' });

    const totalAmount = parseFloat(amount);
    const activeMembers = group.members.filter(m => m.status === 'active');
    const type = splitType || 'equal';
    let computedSplits = [];

    if (type === 'equal') {
      const count = activeMembers.length;
      const perPerson = +(totalAmount / count).toFixed(2);
      const remainder = +(totalAmount - perPerson * count).toFixed(2);

      computedSplits = activeMembers.map((m, idx) => {
        const memberId = m.user._id ? m.user._id : m.user;
        return {
          user: memberId,
          amount: idx === 0 ? +(perPerson + remainder).toFixed(2) : perPerson,
          isPaid: false
        };
      });
    } else if (type === 'exact') {
      if (!inputSplits || !inputSplits.length) return res.status(400).json({ error: 'Splits are required for exact split type' });
      const splitSum = inputSplits.reduce((acc, s) => acc + parseFloat(s.amount), 0);
      if (Math.abs(splitSum - totalAmount) > 0.01) {
        return res.status(400).json({ error: `Split amounts (${splitSum.toFixed(2)}) must sum to total (${totalAmount.toFixed(2)})` });
      }
      computedSplits = inputSplits.map(s => ({
        user: s.user,
        amount: parseFloat(s.amount),
        isPaid: false
      }));
    } else if (type === 'percentage') {
      if (!inputSplits || !inputSplits.length) return res.status(400).json({ error: 'Splits are required for percentage split type' });
      const pctSum = inputSplits.reduce((acc, s) => acc + parseFloat(s.percentage), 0);
      if (Math.abs(pctSum - 100) > 0.01) {
        return res.status(400).json({ error: `Percentages must sum to 100 (got ${pctSum})` });
      }
      computedSplits = inputSplits.map(s => ({
        user: s.user,
        amount: +((parseFloat(s.percentage) / 100) * totalAmount).toFixed(2),
        percentage: parseFloat(s.percentage),
        isPaid: false
      }));
    }

    const expense = await SharedExpense.create({
      group: group._id,
      paidBy: req.user._id,
      amount: totalAmount,
      currency: currency || group.currency || 'GBP',
      description,
      category: category || 'other',
      date: date ? new Date(date) : new Date(),
      splitType: type,
      splits: computedSplits
    });

    const populated = await SharedExpense.findById(expense._id)
      .populate('paidBy', 'name')
      .populate('splits.user', 'name');

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id/expenses — paginated list
router.get('/:id/expenses', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isMember(group, req.user._id)) return res.status(403).json({ error: 'Access denied' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [expenses, total] = await Promise.all([
      SharedExpense.find({ group: group._id })
        .populate('paidBy', 'name')
        .populate('splits.user', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      SharedExpense.countDocuments({ group: group._id })
    ]);

    res.json({
      expenses,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/groups/:id/expenses/:expenseId
router.delete('/:id/expenses/:expenseId', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('members.user', 'name email');
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isMember(group, req.user._id)) return res.status(403).json({ error: 'Access denied' });

    const expense = await SharedExpense.findOne({ _id: req.params.expenseId, group: group._id });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    const isPayer = expense.paidBy.toString() === req.user._id.toString();
    const isAdmin = isOwnerOrAdmin(group, req.user._id);
    if (!isPayer && !isAdmin) return res.status(403).json({ error: 'Not authorized to delete this expense' });

    await SharedExpense.findByIdAndDelete(expense._id);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id/balances
router.get('/:id/balances', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('members.user', 'name email');
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isMember(group, req.user._id)) return res.status(403).json({ error: 'Access denied' });

    const [expenses, settlements] = await Promise.all([
      SharedExpense.find({ group: group._id }).lean(),
      Settlement.find({ group: group._id }).lean()
    ]);

    // Build user map from group members
    const userMap = {};
    group.members.forEach(m => {
      const uid = m.user._id ? m.user._id.toString() : m.user.toString();
      const name = m.user.name || 'Unknown';
      userMap[uid] = name;
    });

    // debts[from][to] = amount owed (from owes to)
    const debts = {};
    let totalGroupSpend = 0;
    let yourShare = 0;

    for (const expense of expenses) {
      const payerId = expense.paidBy.toString();
      totalGroupSpend += expense.amount;

      for (const split of expense.splits) {
        const splitUserId = split.user.toString();
        if (splitUserId === payerId) continue; // payer doesn't owe themselves

        if (splitUserId === req.user._id.toString()) {
          yourShare += split.amount;
        }

        if (!debts[splitUserId]) debts[splitUserId] = {};
        debts[splitUserId][payerId] = (debts[splitUserId][payerId] || 0) + split.amount;
      }
    }

    // Net out bidirectional debts
    const allIds = Object.keys(debts);
    for (const fromId of allIds) {
      for (const toId of Object.keys(debts[fromId] || {})) {
        if (debts[toId] && debts[toId][fromId]) {
          const aOwesB = debts[fromId][toId];
          const bOwesA = debts[toId][fromId];
          if (aOwesB >= bOwesA) {
            debts[fromId][toId] = +(aOwesB - bOwesA).toFixed(2);
            debts[toId][fromId] = 0;
          } else {
            debts[toId][fromId] = +(bOwesA - aOwesB).toFixed(2);
            debts[fromId][toId] = 0;
          }
        }
      }
    }

    // Apply settlements
    for (const settlement of settlements) {
      const fromId = settlement.paidBy.toString();
      const toId = settlement.paidTo.toString();
      if (debts[fromId] && debts[fromId][toId] !== undefined) {
        debts[fromId][toId] = Math.max(0, +(debts[fromId][toId] - settlement.amount).toFixed(2));
      }
    }

    // Build net balance arrays for greedy simplification
    const netBalance = {}; // positive = owed money, negative = owes money
    for (const fromId of Object.keys(debts)) {
      for (const toId of Object.keys(debts[fromId])) {
        const amt = debts[fromId][toId];
        if (amt <= 0.005) continue;
        netBalance[fromId] = (netBalance[fromId] || 0) - amt;
        netBalance[toId] = (netBalance[toId] || 0) + amt;
      }
    }

    // Greedy simplification
    const creditors = []; // owed money
    const debtors = []; // owe money
    for (const [userId, balance] of Object.entries(netBalance)) {
      if (balance > 0.005) creditors.push({ id: userId, amount: balance });
      else if (balance < -0.005) debtors.push({ id: userId, amount: -balance });
    }
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const simplifiedBalances = [];
    let ci = 0;
    let di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const creditor = creditors[ci];
      const debtor = debtors[di];
      const amount = Math.min(creditor.amount, debtor.amount);

      if (amount > 0.005) {
        simplifiedBalances.push({
          from: { id: debtor.id, name: userMap[debtor.id] || debtor.id },
          to: { id: creditor.id, name: userMap[creditor.id] || creditor.id },
          amount: +amount.toFixed(2)
        });
      }

      creditor.amount -= amount;
      debtor.amount -= amount;
      if (creditor.amount < 0.005) ci++;
      if (debtor.amount < 0.005) di++;
    }

    const currentUserId = req.user._id.toString();
    const youOwe = simplifiedBalances
      .filter(b => b.from.id === currentUserId)
      .reduce((sum, b) => sum + b.amount, 0);
    const youAreOwed = simplifiedBalances
      .filter(b => b.to.id === currentUserId)
      .reduce((sum, b) => sum + b.amount, 0);

    res.json({
      balances: simplifiedBalances,
      summary: {
        totalGroupSpend: +totalGroupSpend.toFixed(2),
        yourShare: +yourShare.toFixed(2),
        youAreOwed: +youAreOwed.toFixed(2),
        youOwe: +youOwe.toFixed(2)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:id/settlements
router.post('/:id/settlements', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isMember(group, req.user._id)) return res.status(403).json({ error: 'Access denied' });

    const { paidTo, amount, note } = req.body;
    if (!paidTo) return res.status(400).json({ error: 'paidTo is required' });
    if (!amount || amount < 0.01) return res.status(400).json({ error: 'Valid amount is required' });

    const settlement = await Settlement.create({
      group: group._id,
      paidBy: req.user._id,
      paidTo,
      amount: parseFloat(amount),
      currency: group.currency || 'GBP',
      note: note || ''
    });

    const populated = await Settlement.findById(settlement._id)
      .populate('paidBy', 'name')
      .populate('paidTo', 'name');

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id/settlements
router.get('/:id/settlements', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isMember(group, req.user._id)) return res.status(403).json({ error: 'Access denied' });

    const settlements = await Settlement.find({ group: group._id })
      .populate('paidBy', 'name')
      .populate('paidTo', 'name')
      .sort({ createdAt: -1 });

    res.json({ settlements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
