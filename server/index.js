const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const categoryRoutes = require('./routes/categories');
const analyticsRoutes = require('./routes/analytics');
const budgetRoutes = require('./routes/budgets');
const recurringRoutes = require('./routes/recurring');
const activityRoutes = require('./routes/activity');
const aiRoutes = require('./routes/ai');
const groupRoutes = require('./routes/groups');
const currencyRoutes = require('./routes/currencies');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, /\.vercel\.app$/]
    : ['http://localhost:5173', 'http://localhost:5174', /\.vercel\.app$/],
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/currencies', currencyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Database connection & server start
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-tracker';

if (process.env.VERCEL !== '1') {
  // Local development — connect then start HTTP server
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('✅ MongoDB connected');
      app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err.message);
      process.exit(1);
    });
} else {
  // Vercel serverless — connect once, Mongoose reuses the connection on warm invocations
  mongoose.connect(MONGODB_URI).catch(err =>
    console.error('❌ MongoDB connection error:', err.message)
  );
}

module.exports = app;
