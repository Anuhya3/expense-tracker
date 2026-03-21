export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  currency: string;
  monthlyBudget?: number;
}

export interface ExpenseSplit {
  label: string;
  amount: number;
}

export interface Expense {
  _id: string;
  amount: number;
  description: string;
  category: CategoryId;
  date: string;
  paymentMethod: string;
  isRecurring: boolean;
  tags?: string[];
  splits?: ExpenseSplit[];
  createdAt: string;
  currency?: string;
  originalAmount?: number;
  exchangeRate?: number;
}

export type CategoryId =
  | 'food' | 'transport' | 'housing' | 'utilities'
  | 'entertainment' | 'healthcare' | 'shopping'
  | 'education' | 'travel' | 'subscriptions' | 'other';

export interface Category {
  id: CategoryId;
  label: string;
  icon: string;
  color: string;
}

export interface Budget {
  _id: string;
  category: CategoryId;
  limit: number;
  month: number;
  year: number;
}

export interface SummaryData {
  currentMonth: {
    total: number;
    count: number;
    avgPerTransaction: number;
    budget: number;
    budgetUsed: number;
  };
  lastMonth: { total: number; count: number };
  today: { total: number; count: number };
  monthOverMonthChange: number;
}

export interface CategoryBreakdown {
  category: CategoryId;
  total: number;
  count: number;
  avg: number;
  percentage: number;
}

export interface TagBreakdown {
  tag: string;
  total: number;
  count: number;
  percentage: number;
}

export interface TrendPoint {
  date: string;
  total: number;
  count: number;
}

export interface BudgetStatus {
  category: CategoryId;
  limit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  isOverBudget: boolean;
}

export interface Insight {
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  icon: string;
}

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';

export interface RecurringExpense {
  _id: string;
  amount: number;
  description: string;
  category: CategoryId;
  paymentMethod: string;
  frequency: RecurringFrequency;
  nextDueDate: string;
  isActive: boolean;
  lastGenerated?: string;
  createdAt: string;
}

// AI types
export interface ReceiptScanResult {
  amount: number;
  description: string;
  category: CategoryId;
  date: string | null;
  confidence: number;
  items: string[];
}

export interface CategorizationResult {
  category: CategoryId;
  confidence: number;
  reasoning: string;
}

export interface BulkCategorizationItem extends CategorizationResult {
  index: number;
  description: string;
}

export interface AIStatus {
  available: boolean;
  mode: 'live' | 'demo';
}

// Groups
export interface Group {
  _id: string;
  name: string;
  description?: string;
  owner: string;
  members: GroupMember[];
  currency: string;
  isSettled: boolean;
  createdAt: string;
}

export interface GroupMember {
  _id?: string;
  user: { _id: string; name: string; email: string } | string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  status: 'active' | 'invited' | 'left';
}

export interface SharedExpense {
  _id: string;
  group: string;
  paidBy: { _id: string; name: string };
  amount: number;
  currency: string;
  description: string;
  category: CategoryId;
  date: string;
  splitType: 'equal' | 'exact' | 'percentage';
  splits: SharedExpenseSplit[];
  createdAt: string;
}

export interface SharedExpenseSplit {
  user: { _id: string; name: string } | string;
  amount: number;
  percentage?: number;
  isPaid: boolean;
  paidAt?: string;
}

export interface GroupBalance {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
}

export interface GroupBalanceResponse {
  balances: GroupBalance[];
  summary: {
    totalGroupSpend: number;
    yourShare: number;
    youAreOwed: number;
    youOwe: number;
  };
}

export interface Settlement {
  _id: string;
  group: string;
  paidBy: { _id: string; name: string };
  paidTo: { _id: string; name: string };
  amount: number;
  currency: string;
  note?: string;
  createdAt: string;
}

// Currency
export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export interface ConversionResult {
  from: string;
  to: string;
  amount: number;
  convertedAmount: number;
  rate: number;
}

export type ActivityAction =
  | 'expense_created' | 'expense_updated' | 'expense_deleted'
  | 'budget_set' | 'budget_exceeded' | 'recurring_generated' | 'login';

export interface Activity {
  _id: string;
  action: ActivityAction;
  entityType: 'expense' | 'budget' | 'recurring' | 'auth';
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
