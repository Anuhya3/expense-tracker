import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock all data hooks so no real API calls happen ───────────────────────

const mockSummary = {
  currentMonth: {
    total: 2456.78,
    count: 18,
    avgPerTransaction: 136.49,
    budget: 3000,
    budgetUsed: 81.9,
  },
  lastMonth: { total: 1980.0, count: 14 },
  today: { total: 45.0, count: 2 },
  monthOverMonthChange: 24.1,
};

vi.mock('../hooks/useData', () => ({
  useSummary: () => ({ data: mockSummary, loading: false, error: null }),
  useCategoryBreakdown: () => ({ data: { breakdown: [], total: 0 }, loading: false }),
  useTrends: () => ({ data: { trends: [], days: 30 }, loading: false }),
  useBudgetStatus: () => ({ data: { budgetStatus: [] }, loading: false }),
  useInsights: () => ({ data: { insights: [] }, loading: false }),
  useActivity: () => ({ data: { activities: [], pagination: {} }, loading: false }),
}));

// ── Mock heavy sub-components ─────────────────────────────────────────────

vi.mock('../components/InsightsPanel', () => ({
  default: () => <div data-testid="insights-panel" />,
}));

vi.mock('../components/ActivityFeed', () => ({
  default: () => <div data-testid="activity-feed" />,
}));

vi.mock('../components/DashboardWidget', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/DashboardWidget')>();
  return {
    ...actual,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

// Recharts uses SVG measurements that jsdom can't compute — stub the library
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Pie: () => null,
  Cell: () => null,
}));

import Dashboard from '../pages/Dashboard';

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Dashboard summary cards', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the formatted current-month total', () => {
    renderDashboard();
    // formatCurrency(2456.78, 'GBP') → "£2,456.78"
    expect(screen.getByText('£2,456.78')).toBeInTheDocument();
  });

  it('renders the transaction count as part of the sub-label', () => {
    renderDashboard();
    // The count card shows "18 transactions"
    expect(screen.getByText('18 transactions')).toBeInTheDocument();
  });

  it('renders the month-over-month change percentage', () => {
    renderDashboard();
    // Card shows "+24.1%"
    expect(screen.getByText('+24.1%')).toBeInTheDocument();
  });

  it('renders budget utilisation as a percentage', () => {
    renderDashboard();
    // Card shows "81.9%"
    expect(screen.getByText('81.9%')).toBeInTheDocument();
  });

  it("renders the remaining budget in the budget card's sub-label", () => {
    renderDashboard();
    // budget 3000 - total 2456.78 = 543.22 remaining → formatCurrency → "£543.22"
    expect(screen.getByText(/£543\.22 remaining/)).toBeInTheDocument();
  });

  it("renders today's total spend", () => {
    renderDashboard();
    // formatCurrency(45) → "£45.00"
    expect(screen.getByText('£45.00')).toBeInTheDocument();
  });

  it('renders the insights panel', () => {
    renderDashboard();
    expect(screen.getByTestId('insights-panel')).toBeInTheDocument();
  });

  it('renders the activity feed', () => {
    renderDashboard();
    expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
  });
});
