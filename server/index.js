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

// Initialise Redis client eagerly so the connection is ready before requests arrive.
// getClient() is safe to call multiple times — it returns the singleton.
require('./utils/redis').getClient();

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

// DB-ready gate — every /api request waits for mongoose.connect() to resolve.
// Without this, requests that arrive during a cold start race the connection
// and Mongoose buffers queries until its 10s timeout fires → HTTP 500.
app.use('/api', async (_req, res, next) => {
  try {
    await startupPromise;
    next();
  } catch (err) {
    res.status(503).json({ error: 'Service starting up, please retry' });
  }
});

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

// ── Async startup: start Apollo + connect DB ──────────────────────────────
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-tracker';

const corsOptions = {
  origin: process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, /\.vercel\.app$/]
    : ['http://localhost:5173', 'http://localhost:5174', /\.vercel\.app$/],
  credentials: true
};

async function startServer() {
  // Apollo Server 4 must be started before expressMiddleware handles requests
  await apolloServer.start();
  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB connected');
}

// Fire startup immediately and save the promise.
// On Vercel the module is loaded once per cold start; subsequent requests
// reuse the same module so startupPromise is already resolved.
// NOTE: do NOT .catch() here — the middleware below needs it to reject so
// it can return a 503 instead of silently timing out.
const startupPromise = startServer();
startupPromise.catch(err => console.error('❌ Startup error:', err.message));

// Mount /graphql SYNCHRONOUSLY so the route exists the moment Express
// receives any request — even on a cold start.
// expressMiddleware() must not be called until after apolloServer.start()
// resolves (Apollo 4 enforces this), so we build it lazily on first request
// and cache it for all subsequent ones.
let graphqlHandler = null;
app.use(
  '/graphql',
  cors(corsOptions),
  express.json({ limit: '10mb' }),
  async (req, res, next) => {
    try {
      await startupPromise; // ensures apolloServer.start() is done
      if (!graphqlHandler) {
        graphqlHandler = expressMiddleware(apolloServer, { context: buildContext });
      }
      return graphqlHandler(req, res, next);
    } catch (err) {
      next(err);
    }
  }
);

if (process.env.VERCEL !== '1') {
  startupPromise.then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔭 GraphQL sandbox: http://localhost:${PORT}/graphql`);
    });
  });
}

module.exports = app;
