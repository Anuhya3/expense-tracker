import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ── Mock the API client ────────────────────────────────────────────────────

const mockApiPost = vi.fn();
const mockApiGet = vi.fn();

vi.mock('../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    delete: vi.fn(),
    setToken: vi.fn(),
    download: vi.fn(),
    upload: vi.fn(),
  },
}));

// ── Mock data hooks ───────────────────────────────────────────────────────

const mockRefetch = vi.fn();

vi.mock('../hooks/useData', () => ({
  useExpenses: () => ({
    data: { expenses: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } },
    loading: false,
    error: null,
    refetch: mockRefetch,
  }),
  useTags: () => ({ data: { tags: [] }, loading: false }),
}));

// ── Mock sub-components ───────────────────────────────────────────────────

vi.mock('../components/ReceiptScanner', () => ({
  default: () => <div data-testid="receipt-scanner" />,
}));

vi.mock('../components/CurrencySelector', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      data-testid="currency-selector"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="GBP">GBP</option>
      <option value="USD">USD</option>
    </select>
  ),
}));

import ExpensesPage from '../pages/ExpensesPage';

// ── Helpers ───────────────────────────────────────────────────────────────

function renderExpensesPage() {
  return render(
    <MemoryRouter>
      <ExpensesPage />
    </MemoryRouter>
  );
}

// Click the page-level "Add Expense" button (not the modal submit)
async function openAddModal() {
  // Before the modal opens there is exactly one "Add Expense" button
  const buttons = screen.getAllByRole('button', { name: 'Add Expense' });
  await userEvent.click(buttons[0]);
}

// After the modal opens, the submit button is the SECOND "Add Expense" button
function getSubmitButton() {
  const buttons = screen.getAllByRole('button', { name: 'Add Expense' });
  return buttons[buttons.length - 1];
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('ExpenseForm — add expense modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: currency conversion endpoint returns a sensible value
    mockApiGet.mockResolvedValue({ convertedAmount: 100, rate: 0.79 });
    // Default: AI categorise endpoint returns a category suggestion
    mockApiPost.mockResolvedValue({ data: { category: 'food', confidence: 0.9 } });
  });

  it('renders the page-level "Add Expense" button', () => {
    renderExpensesPage();
    expect(screen.getByRole('button', { name: 'Add Expense' })).toBeInTheDocument();
  });

  it('opens the modal when "Add Expense" is clicked', async () => {
    renderExpensesPage();
    await openAddModal();
    // After opening, the modal's "Cancel" button becomes visible
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows description and amount fields in the modal', async () => {
    renderExpensesPage();
    await openAddModal();
    // The description field placeholder is "What was this for?"
    expect(screen.getByPlaceholderText('What was this for?')).toBeInTheDocument();
    // The amount field placeholder is "0.00"
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
  });

  it('does not call POST /expenses when description is empty', async () => {
    renderExpensesPage();
    await openAddModal();

    // Fill in amount but leave description empty
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '25.00');

    // Try to submit — the description field is `required` so the browser
    // (simulated by jsdom) prevents form submission
    const submitBtn = getSubmitButton();
    await userEvent.click(submitBtn);

    // POST /expenses must NOT have been called
    const expenseCalls = mockApiPost.mock.calls.filter(([ep]) => ep === '/expenses');
    expect(expenseCalls.length).toBe(0);
  });

  it('calls POST /expenses with the correct payload on valid submission', async () => {
    mockApiPost.mockImplementation((endpoint: string) => {
      if (endpoint === '/expenses') {
        return Promise.resolve({
          _id: 'abc123',
          description: 'Coffee',
          amount: 4.5,
          category: 'food',
        });
      }
      // AI categorise endpoint
      return Promise.resolve({ data: { category: 'food', confidence: 0.9 } });
    });

    renderExpensesPage();
    await openAddModal();

    // Fill description
    const descInput = screen.getByPlaceholderText('What was this for?');
    await userEvent.clear(descInput);
    await userEvent.type(descInput, 'Coffee');

    // Fill amount
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '4.50');

    // Submit
    const submitBtn = getSubmitButton();
    await userEvent.click(submitBtn);

    await waitFor(() => {
      const expenseCalls = mockApiPost.mock.calls.filter(([ep]) => ep === '/expenses');
      expect(expenseCalls.length).toBe(1);
      const [, payload] = expenseCalls[0] as [string, Record<string, unknown>];
      expect(payload.description).toBe('Coffee');
      expect(payload.amount).toBe(4.5);
    });
  });

  it('closes the modal when the Cancel button is clicked', async () => {
    renderExpensesPage();
    await openAddModal();

    // Modal is open — Cancel button is present
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await userEvent.click(cancelButton);

    await waitFor(() => {
      // After closing, Cancel button is gone
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });
});
