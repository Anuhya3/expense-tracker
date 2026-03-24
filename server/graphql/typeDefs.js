const { gql } = require('graphql-tag');

const typeDefs = gql`
  # ── Scalars & Enums ──────────────────────────────────────────────────────

  scalar Date

  enum Category {
    food
    transport
    housing
    utilities
    entertainment
    healthcare
    shopping
    education
    travel
    subscriptions
    other
  }

  enum PaymentMethod {
    cash
    credit_card
    debit_card
    bank_transfer
    other
  }

  # ── Core Types ───────────────────────────────────────────────────────────

  type Expense {
    id: ID!
    description: String!
    amount: Float!
    category: Category!
    date: Date!
    paymentMethod: PaymentMethod!
    isRecurring: Boolean!
    tags: [String!]!
    currency: String!
    originalAmount: Float
    exchangeRate: Float
    userId: ID!
    createdAt: Date!
    updatedAt: Date!
  }

  type ExpenseSplit {
    label: String
    amount: Float!
  }

  type PaginationInfo {
    page: Int!
    limit: Int!
    total: Int!
    pages: Int!
  }

  type ExpenseConnection {
    expenses: [Expense!]!
    pagination: PaginationInfo!
  }

  type ExpenseSummary {
    totalAmount: Float!
    count: Int!
    avgPerTransaction: Float!
    month: Int!
    year: Int!
    monthOverMonthChange: Float!
    budget: Float!
    budgetUsed: Float!
  }

  type CategoryBreakdown {
    category: Category!
    total: Float!
    percentage: Float!
    count: Int!
    avg: Float!
  }

  type CategoryBreakdownResult {
    breakdown: [CategoryBreakdown!]!
    total: Float!
  }

  type TrendPoint {
    date: String!
    total: Float!
    count: Int!
  }

  type Budget {
    id: ID!
    category: Category!
    limit: Float!
    month: Int!
    year: Int!
    spent: Float
    remaining: Float
    percentUsed: Float
  }

  type DeleteResult {
    success: Boolean!
    message: String!
  }

  # ── Input Types ──────────────────────────────────────────────────────────

  input ExpenseSplitInput {
    label: String
    amount: Float!
  }

  input ExpenseInput {
    description: String!
    amount: Float!
    category: Category!
    date: Date
    paymentMethod: PaymentMethod
    isRecurring: Boolean
    tags: [String!]
    currency: String
    splits: [ExpenseSplitInput!]
  }

  input BudgetInput {
    category: Category!
    limit: Float!
    month: Int!
    year: Int!
  }

  # ── Queries ──────────────────────────────────────────────────────────────

  type Query {
    """List expenses with optional filters and pagination."""
    expenses(
      limit: Int
      offset: Int
      category: Category
      search: String
      startDate: Date
      endDate: Date
      sort: String
    ): ExpenseConnection!

    """Fetch a single expense by ID."""
    expense(id: ID!): Expense

    """Current-month spending summary with MoM change."""
    summary(month: Int, year: Int): ExpenseSummary!

    """Spending breakdown by category for the last N months (default 1)."""
    expensesByCategory(months: Int): CategoryBreakdownResult!

    """30-day daily spending trend."""
    spendingTrend(days: Int): [TrendPoint!]!

    """All budgets for the current month."""
    budgets(month: Int, year: Int): [Budget!]!
  }

  # ── Mutations ────────────────────────────────────────────────────────────

  type Mutation {
    """Create a new expense."""
    createExpense(input: ExpenseInput!): Expense!

    """Update an existing expense. Only the owner can update."""
    updateExpense(id: ID!, input: ExpenseInput!): Expense!

    """Delete an expense. Only the owner can delete."""
    deleteExpense(id: ID!): DeleteResult!

    """Create or update a budget for a category+month+year."""
    upsertBudget(input: BudgetInput!): Budget!
  }
`;

module.exports = typeDefs;
