const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const RecurringExpense = require('../models/RecurringExpense');
const Activity = require('../models/Activity');
const Group = require('../models/Group');
const SharedExpense = require('../models/SharedExpense');
const Settlement = require('../models/Settlement');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-tracker';

const categories = ['food', 'transport', 'housing', 'utilities', 'entertainment', 'healthcare', 'shopping', 'education', 'travel', 'subscriptions'];
const paymentMethods = ['cash', 'credit_card', 'debit_card', 'bank_transfer'];

const descriptions = {
  food: ['Tesco grocery shop', 'Pret lunch', 'Deliveroo dinner', 'Costa coffee', 'Nando\'s with friends', 'Sainsbury\'s weekly shop', 'Borough Market haul'],
  transport: ['Oyster top-up', 'Uber to meeting', 'Monthly travelcard', 'Bolt ride', 'Petrol top-up', 'Train to Manchester'],
  housing: ['Monthly rent', 'Contents insurance', 'Council tax', 'Home repairs'],
  utilities: ['Electric bill', 'Water bill', 'Internet bill', 'Gas bill', 'Phone bill'],
  entertainment: ['Netflix subscription', 'Cinema tickets', 'Spotify Premium', 'Concert tickets', 'PS5 game'],
  healthcare: ['GP prescription', 'Gym membership', 'Dental checkup', 'Vitamins'],
  shopping: ['Amazon order', 'New trainers', 'Winter jacket', 'Birthday gift', 'Book from Waterstones'],
  education: ['Udemy course', 'O\'Reilly subscription', 'Conference ticket', 'Textbook'],
  travel: ['Flight to Barcelona', 'Airbnb weekend', 'Travel insurance', 'Museum tickets abroad'],
  subscriptions: ['ChatGPT Plus', 'GitHub Copilot', 'iCloud storage', 'Notion Pro', 'Medium membership']
};

const amountRanges = {
  food: [3, 120], transport: [2, 180], housing: [800, 1600],
  utilities: [20, 100], entertainment: [5, 80], healthcare: [10, 150],
  shopping: [10, 200], education: [10, 300], travel: [50, 500],
  subscriptions: [5, 25]
};

const tagPool = ['work', 'personal', 'team', 'reimbursable', 'holiday', 'health', 'luxury', 'essential', 'client'];

function randomBetween(min, max) {
  return +(Math.random() * (max - min) + min).toFixed(2);
}

function randomDate(daysBack) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  date.setHours(Math.floor(Math.random() * 14) + 8);
  date.setMinutes(Math.floor(Math.random() * 60));
  return date;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function randomTags() {
  if (Math.random() > 0.65) return [];
  const count = Math.random() > 0.6 ? 2 : 1;
  const shuffled = [...tagPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Expense.deleteMany({}),
      Budget.deleteMany({}),
      RecurringExpense.deleteMany({}),
      Activity.deleteMany({}),
      Group.deleteMany({}),
      SharedExpense.deleteMany({}),
      Settlement.deleteMany({})
    ]);

    // Create demo user
    const user = await User.create({
      name: 'Anuhya',
      email: 'demo@expense.app',
      password: 'demo123',
      currency: 'GBP',
      monthlyBudget: 2500
    });
    console.log('✅ Demo user created (demo@expense.app / demo123)');

    // Create admin user
    const adminUser = await User.create({
      name: 'Admin',
      email: 'admin@expense.app',
      password: 'admin123',
      role: 'admin',
      currency: 'GBP',
      monthlyBudget: 3000
    });
    console.log('✅ Admin user created (admin@expense.app / admin123)');

    // Generate 90 days of expenses (~200 entries) — some with tags & splits
    const expenses = [];
    for (let i = 0; i < 200; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const descs = descriptions[category];
      const [minAmt, maxAmt] = amountRanges[category];
      const amount = randomBetween(minAmt, maxAmt);
      const tags = randomTags();

      // Add splits to ~10% of food/shopping expenses
      let splits = [];
      if ((category === 'food' || category === 'shopping') && Math.random() > 0.88) {
        const half = +(amount / 2).toFixed(2);
        splits = [
          { label: 'My share', amount: half },
          { label: 'Friend\'s share', amount: +(amount - half).toFixed(2) }
        ];
      }

      expenses.push({
        user: user._id,
        amount,
        description: descs[Math.floor(Math.random() * descs.length)],
        category,
        date: randomDate(90),
        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
        isRecurring: Math.random() > 0.85,
        tags,
        splits,
        currency: 'GBP',
        originalAmount: amount,
        exchangeRate: 1
      });
    }

    // Add foreign currency expenses
    const foreignCurrencyExpenses = [
      {
        user: user._id,
        description: 'Flight to Barcelona',
        category: 'travel',
        amount: 91.77,
        currency: 'EUR',
        originalAmount: 106,
        exchangeRate: 0.866,
        date: daysAgo(5),
        paymentMethod: 'credit_card',
        isRecurring: false,
        tags: ['holiday'],
        splits: []
      },
      {
        user: user._id,
        description: 'Amazon US — headphones',
        category: 'shopping',
        amount: 63.50,
        currency: 'USD',
        originalAmount: 80,
        exchangeRate: 0.794,
        date: daysAgo(8),
        paymentMethod: 'credit_card',
        isRecurring: false,
        tags: [],
        splits: []
      },
      {
        user: user._id,
        description: 'Mumbai street food tour',
        category: 'food',
        amount: 11.85,
        currency: 'INR',
        originalAmount: 1250,
        exchangeRate: 0.00948,
        date: daysAgo(12),
        paymentMethod: 'cash',
        isRecurring: false,
        tags: ['holiday'],
        splits: []
      },
      {
        user: user._id,
        description: 'Tokyo ramen dinner',
        category: 'food',
        amount: 12.62,
        currency: 'JPY',
        originalAmount: 2400,
        exchangeRate: 0.00526,
        date: daysAgo(20),
        paymentMethod: 'cash',
        isRecurring: false,
        tags: ['holiday'],
        splits: []
      },
      {
        user: user._id,
        description: 'Airbnb Sydney — 3 nights',
        category: 'travel',
        amount: 233.16,
        currency: 'AUD',
        originalAmount: 450,
        exchangeRate: 0.518,
        date: daysAgo(25),
        paymentMethod: 'credit_card',
        isRecurring: false,
        tags: ['holiday'],
        splits: []
      },
      {
        user: user._id,
        description: 'SG coworking day pass',
        category: 'education',
        amount: 29.41,
        currency: 'SGD',
        originalAmount: 50,
        exchangeRate: 0.588,
        date: daysAgo(30),
        paymentMethod: 'debit_card',
        isRecurring: false,
        tags: ['work'],
        splits: []
      },
      {
        user: user._id,
        description: 'Paris hotel — weekend',
        category: 'travel',
        amount: 231.00,
        currency: 'EUR',
        originalAmount: 267,
        exchangeRate: 0.865,
        date: daysAgo(35),
        paymentMethod: 'credit_card',
        isRecurring: false,
        tags: ['holiday'],
        splits: []
      },
      {
        user: user._id,
        description: 'Canadian conference ticket',
        category: 'education',
        amount: 290.58,
        currency: 'CAD',
        originalAmount: 500,
        exchangeRate: 0.581,
        date: daysAgo(40),
        paymentMethod: 'credit_card',
        isRecurring: false,
        tags: ['work', 'reimbursable'],
        splits: []
      },
      {
        user: user._id,
        description: 'Swiss train pass',
        category: 'transport',
        amount: 212.39,
        currency: 'CHF',
        originalAmount: 240,
        exchangeRate: 0.885,
        date: daysAgo(45),
        paymentMethod: 'debit_card',
        isRecurring: false,
        tags: ['holiday'],
        splits: []
      },
      {
        user: user._id,
        description: 'Zara Madrid shopping',
        category: 'shopping',
        amount: 86.50,
        currency: 'EUR',
        originalAmount: 100,
        exchangeRate: 0.865,
        date: daysAgo(6),
        paymentMethod: 'credit_card',
        isRecurring: false,
        tags: [],
        splits: []
      },
      {
        user: user._id,
        description: 'New York cab rides',
        category: 'transport',
        amount: 55.58,
        currency: 'USD',
        originalAmount: 70,
        exchangeRate: 0.794,
        date: daysAgo(50),
        paymentMethod: 'cash',
        isRecurring: false,
        tags: ['work'],
        splits: []
      },
      {
        user: user._id,
        description: 'NZ adventure tour',
        category: 'entertainment',
        amount: 103.64,
        currency: 'NZD',
        originalAmount: 200,
        exchangeRate: 0.518,
        date: daysAgo(60),
        paymentMethod: 'credit_card',
        isRecurring: false,
        tags: ['holiday', 'luxury'],
        splits: []
      },
      {
        user: user._id,
        description: 'Dubai mall dinner',
        category: 'food',
        amount: 42.83,
        currency: 'AED',
        originalAmount: 200,
        exchangeRate: 0.214,
        date: daysAgo(15),
        paymentMethod: 'credit_card',
        isRecurring: false,
        tags: [],
        splits: []
      },
      {
        user: user._id,
        description: 'Seoul skincare haul',
        category: 'shopping',
        amount: 59.77,
        currency: 'KRW',
        originalAmount: 100000,
        exchangeRate: 0.000598,
        date: daysAgo(18),
        paymentMethod: 'credit_card',
        isRecurring: false,
        tags: ['personal'],
        splits: []
      },
      {
        user: user._id,
        description: 'Brazil conference dinner',
        category: 'food',
        amount: 39.68,
        currency: 'BRL',
        originalAmount: 250,
        exchangeRate: 0.159,
        date: daysAgo(55),
        paymentMethod: 'cash',
        isRecurring: false,
        tags: ['work', 'reimbursable'],
        splits: []
      }
    ];

    await Expense.insertMany([...expenses, ...foreignCurrencyExpenses]);
    console.log(`✅ ${expenses.length + foreignCurrencyExpenses.length} expenses created (90-day spread, with tags, splits & foreign currencies)`);

    // Create budgets for current month
    const now = new Date();
    const budgetData = [
      { category: 'food', limit: 400 },
      { category: 'transport', limit: 200 },
      { category: 'housing', limit: 1500 },
      { category: 'utilities', limit: 150 },
      { category: 'entertainment', limit: 100 },
      { category: 'shopping', limit: 200 },
      { category: 'subscriptions', limit: 60 }
    ];

    const budgets = budgetData.map(b => ({
      user: user._id, ...b, month: now.getMonth() + 1, year: now.getFullYear()
    }));

    await Budget.insertMany(budgets);
    console.log(`✅ ${budgets.length} category budgets created`);

    // Create 5 recurring expense templates
    const nextMonth1 = new Date(); nextMonth1.setDate(1); nextMonth1.setMonth(nextMonth1.getMonth() + 1);
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
    const next15 = new Date(); next15.setDate(15);
    if (next15 < now) next15.setMonth(next15.getMonth() + 1);

    const recurringTemplates = [
      {
        user: user._id,
        amount: 1250,
        description: 'Monthly rent',
        category: 'housing',
        paymentMethod: 'bank_transfer',
        frequency: 'monthly',
        nextDueDate: nextMonth1,
        isActive: true
      },
      {
        user: user._id,
        amount: 40,
        description: 'Gym membership',
        category: 'healthcare',
        paymentMethod: 'debit_card',
        frequency: 'monthly',
        nextDueDate: next15,
        isActive: true
      },
      {
        user: user._id,
        amount: 17.99,
        description: 'Netflix subscription',
        category: 'entertainment',
        paymentMethod: 'credit_card',
        frequency: 'monthly',
        nextDueDate: next15,
        isActive: true
      },
      {
        user: user._id,
        amount: 25,
        description: 'Phone bill',
        category: 'utilities',
        paymentMethod: 'debit_card',
        frequency: 'monthly',
        nextDueDate: nextMonth1,
        isActive: true
      },
      {
        user: user._id,
        amount: 11.99,
        description: 'Spotify Premium',
        category: 'subscriptions',
        paymentMethod: 'credit_card',
        frequency: 'monthly',
        nextDueDate: nextWeek,
        isActive: false
      }
    ];

    await RecurringExpense.insertMany(recurringTemplates);
    console.log(`✅ ${recurringTemplates.length} recurring expense templates created`);

    // Create 20 activity log entries
    const actions = [
      { action: 'login', entityType: 'auth', metadata: { email: user.email } },
      { action: 'expense_created', entityType: 'expense', metadata: { amount: 45.50, description: 'Tesco grocery shop', category: 'food' } },
      { action: 'expense_created', entityType: 'expense', metadata: { amount: 12.99, description: 'Spotify Premium', category: 'subscriptions' } },
      { action: 'budget_set', entityType: 'budget', metadata: { category: 'food', limit: 400 } },
      { action: 'expense_updated', entityType: 'expense', metadata: { amount: 55.00, description: 'Tesco grocery shop', category: 'food' } },
      { action: 'expense_created', entityType: 'expense', metadata: { amount: 8.50, description: 'Costa coffee', category: 'food' } },
      { action: 'recurring_generated', entityType: 'recurring', metadata: { count: 2 } },
      { action: 'expense_created', entityType: 'expense', metadata: { amount: 1250, description: 'Monthly rent', category: 'housing' } },
      { action: 'budget_set', entityType: 'budget', metadata: { category: 'transport', limit: 200 } },
      { action: 'expense_deleted', entityType: 'expense', metadata: { amount: 12.99, description: 'Duplicate entry', category: 'subscriptions' } },
      { action: 'login', entityType: 'auth', metadata: { email: user.email } },
      { action: 'expense_created', entityType: 'expense', metadata: { amount: 32.00, description: 'Oyster top-up', category: 'transport' } },
      { action: 'expense_created', entityType: 'expense', metadata: { amount: 79.99, description: 'New trainers', category: 'shopping' } },
      { action: 'budget_exceeded', entityType: 'budget', metadata: { category: 'shopping', spent: 210, limit: 200 } },
      { action: 'expense_created', entityType: 'expense', metadata: { amount: 24.50, description: 'Pret lunch', category: 'food' } },
      { action: 'expense_created', entityType: 'expense', metadata: { amount: 15.00, description: 'Vitamins', category: 'healthcare' } },
      { action: 'recurring_generated', entityType: 'recurring', metadata: { count: 1 } },
      { action: 'expense_created', entityType: 'expense', metadata: { amount: 299, description: 'Flight to Barcelona', category: 'travel' } },
      { action: 'budget_set', entityType: 'budget', metadata: { category: 'entertainment', limit: 100 } },
      { action: 'expense_updated', entityType: 'expense', metadata: { amount: 299, description: 'Flight to Barcelona (updated)', category: 'travel' } }
    ];

    const activityEntries = actions.map((a, i) => {
      const date = new Date();
      date.setHours(date.getHours() - (i * 6));
      return { user: user._id, ...a, createdAt: date, updatedAt: date };
    });

    await Activity.insertMany(activityEntries);
    console.log(`✅ ${activityEntries.length} activity log entries created`);

    // ── Groups ────────────────────────────────────────────────────────────────

    // Group 1: Flat Share
    const flatShareGroup = await Group.create({
      name: 'Flat Share',
      description: 'Shared expenses for the flat',
      owner: user._id,
      currency: 'GBP',
      members: [
        { user: user._id, role: 'owner', status: 'active', joinedAt: daysAgo(60) },
        { user: adminUser._id, role: 'member', status: 'active', joinedAt: daysAgo(58) }
      ]
    });
    console.log('✅ Group "Flat Share" created');

    const flatShareExpenses = [
      { description: 'Weekly grocery shop — Tesco', category: 'food', amount: 87.40, daysBack: 2 },
      { description: 'Electricity bill — March', category: 'utilities', amount: 68.50, daysBack: 5 },
      { description: 'Internet — BT broadband', category: 'utilities', amount: 39.99, daysBack: 10 },
      { description: 'Netflix shared plan', category: 'subscriptions', amount: 17.99, daysBack: 12 },
      { description: 'Takeaway — Deliveroo', category: 'food', amount: 52.80, daysBack: 15 },
      { description: 'Cleaning supplies', category: 'shopping', amount: 24.30, daysBack: 18 },
      { description: 'Gas bill — Feb', category: 'utilities', amount: 74.20, daysBack: 20 },
      { description: 'Sainsbury\'s big shop', category: 'food', amount: 112.60, daysBack: 25 },
      { description: 'Council tax — March', category: 'housing', amount: 180.00, daysBack: 28 },
      { description: 'Water bill — Q1', category: 'utilities', amount: 45.00, daysBack: 35 }
    ];

    const flatShareExpenseDocs = [];
    for (const exp of flatShareExpenses) {
      const paidBy = Math.random() > 0.5 ? user._id : adminUser._id;
      const perPerson = +(exp.amount / 2).toFixed(2);
      const remainder = +(exp.amount - perPerson * 2).toFixed(2);
      flatShareExpenseDocs.push({
        group: flatShareGroup._id,
        paidBy,
        amount: exp.amount,
        currency: 'GBP',
        description: exp.description,
        category: exp.category,
        date: daysAgo(exp.daysBack),
        splitType: 'equal',
        splits: [
          { user: user._id, amount: +(perPerson + remainder).toFixed(2), isPaid: false },
          { user: adminUser._id, amount: perPerson, isPaid: false }
        ]
      });
    }

    await SharedExpense.insertMany(flatShareExpenseDocs);
    console.log(`✅ ${flatShareExpenseDocs.length} shared expenses created for "Flat Share"`);

    // Settlements for Flat Share
    await Settlement.insertMany([
      {
        group: flatShareGroup._id,
        paidBy: adminUser._id,
        paidTo: user._id,
        amount: 50.00,
        currency: 'GBP',
        note: 'Bank transfer',
        createdAt: daysAgo(14)
      },
      {
        group: flatShareGroup._id,
        paidBy: user._id,
        paidTo: adminUser._id,
        amount: 35.20,
        currency: 'GBP',
        note: 'Cash',
        createdAt: daysAgo(7)
      }
    ]);
    console.log('✅ 2 settlements created for "Flat Share"');

    // Group 2: Weekend Trip — Barcelona
    const barcelonaGroup = await Group.create({
      name: 'Weekend Trip — Barcelona',
      description: 'Flights, hotel, food and fun in Barcelona',
      owner: user._id,
      currency: 'EUR',
      members: [
        { user: user._id, role: 'owner', status: 'active', joinedAt: daysAgo(20) },
        { user: adminUser._id, role: 'member', status: 'active', joinedAt: daysAgo(20) }
      ]
    });
    console.log('✅ Group "Weekend Trip — Barcelona" created');

    const barcelonaExpenses = [
      { description: 'Return flights — EasyJet', category: 'travel', amount: 212, paidBy: user._id },
      { description: 'Hotel — Generator Barcelona (3 nights)', category: 'travel', amount: 378, paidBy: adminUser._id },
      { description: 'Tapas dinner — La Barceloneta', category: 'food', amount: 94.50, paidBy: user._id },
      { description: 'Sagrada Familia tickets', category: 'entertainment', amount: 60, paidBy: adminUser._id },
      { description: 'Airport taxis x2', category: 'transport', amount: 48, paidBy: user._id }
    ];

    const barcelonaExpenseDocs = [];
    for (const exp of barcelonaExpenses) {
      const perPerson = +(exp.amount / 2).toFixed(2);
      const remainder = +(exp.amount - perPerson * 2).toFixed(2);
      barcelonaExpenseDocs.push({
        group: barcelonaGroup._id,
        paidBy: exp.paidBy,
        amount: exp.amount,
        currency: 'EUR',
        description: exp.description,
        category: exp.category,
        date: daysAgo(Math.floor(Math.random() * 10) + 5),
        splitType: 'equal',
        splits: [
          { user: user._id, amount: +(perPerson + remainder).toFixed(2), isPaid: false },
          { user: adminUser._id, amount: perPerson, isPaid: false }
        ]
      });
    }

    await SharedExpense.insertMany(barcelonaExpenseDocs);
    console.log(`✅ ${barcelonaExpenseDocs.length} shared expenses created for "Weekend Trip — Barcelona"`);

    console.log('\n🎉 Seed complete! Run the app and login with:');
    console.log('   Email: demo@expense.app');
    console.log('   Password: demo123');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
