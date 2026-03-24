const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const buildContext = require('./graphql/context');
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

// ── Apollo Server setup ────────────────────────────────────────────────────
const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  // Sandbox is enabled by default in non-production environments
  introspection: true,
  ...(process.env.NODE_ENV === 'production' && {
    plugins: [
      // Disable landing page in production (keeps introspection for tooling)
      {
        async serverWillStart() {
          return {
            async renderLandingPage() {
              return {
                html: '<html><body><h2>ExpenseFlow GraphQL API</h2><p>Introspection is available. Use a GraphQL client to query <code>/graphql</code>.</p></body></html>'
              };
            }
          };
        }
      }
    ]
  })
});

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
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ── Async startup: start Apollo, mount /graphql, connect DB ───────────────
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-tracker';

const corsOptions = {
  origin: process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, /\.vercel\.app$/]
    : ['http://localhost:5173', 'http://localhost:5174', /\.vercel\.app$/],
  credentials: true
};

async function startServer() {
  // Apollo Server 4 must be started before expressMiddleware is used
  await apolloServer.start();

  // Mount GraphQL at /graphql — Apollo Sandbox auto-enabled in development
  app.use(
    '/graphql',
    cors(corsOptions),
    express.json({ limit: '10mb' }), // higher limit for query batching
    expressMiddleware(apolloServer, {
      context: buildContext
    })
  );

  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB connected');

  if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔭 GraphQL sandbox: http://localhost:${PORT}/graphql`);
    });
  }
}

if (process.env.VERCEL !== '1') {
  startServer().catch(err => {
    console.error('❌ Startup error:', err.message);
    process.exit(1);
  });
} else {
  // Vercel serverless: start Apollo and connect DB eagerly on cold start
  startServer().catch(err =>
    console.error('❌ Startup error:', err.message)
  );
}

module.exports = app;
