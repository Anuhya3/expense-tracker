import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useGroupDetail, useGroupExpenses, useGroupBalances, useGroupSettlements
} from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { GroupMember, SharedExpense, GroupBalance, Settlement, CategoryId } from '../types';
import {
  ArrowLeft, Plus, X, Users, DollarSign, TrendingDown, TrendingUp,
  Trash2, ChevronDown, ChevronUp, Mail, UserMinus, Settings, Receipt, Scale
} from 'lucide-react';
import { formatCurrency, formatDate, getCategoryInfo } from '../utils/format';

function getMemberUser(member: GroupMember): { _id: string; name: string; email: string } | null {
  if (typeof member.user === 'string') return null;
  return member.user as { _id: string; name: string; email: string };
}

const CATEGORIES: CategoryId[] = [
  'food', 'transport', 'housing', 'utilities', 'entertainment',
  'healthcare', 'shopping', 'education', 'travel', 'subscriptions', 'other'
];

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
  'bg-orange-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500'
];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Expense Card ──────────────────────────────────────────────────────────────

function ExpenseCard({ expense, groupId, onDeleted, isOwnerAdmin }: {
  expense: SharedExpense;
  groupId: string;
  onDeleted: () => void;
  isOwnerAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuth();
  const info = getCategoryInfo(expense.category);

  const isPayer = expense.paidBy._id === user?.id;
  const canDelete = isPayer || isOwnerAdmin;

  const handleDelete = async () => {
    if (!confirm('Delete this expense?')) return;
    setDeleting(true);
    try {
      await api.delete(`/groups/${groupId}/expenses/${expense._id}`);
      onDeleted();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
          style={{ backgroundColor: info.color + '20' }}
        >
          {info.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 dark:text-white truncate">{expense.description}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
              style={{ backgroundColor: info.color + '15', color: info.color }}
            >
              {expense.splitType}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Paid by <span className="font-medium">{expense.paidBy.name}</span> · {formatDate(expense.date)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-gray-900 dark:text-white">
            {formatCurrency(expense.amount, expense.currency)}
          </span>
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-700/40 space-y-1.5">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Splits</div>
          {expense.splits.map((split, i) => {
            const splitUser = typeof split.user === 'string' ? null : split.user as { _id: string; name: string };
            const name = splitUser?.name || 'Unknown';
            return (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white text-[10px] font-bold`}>
                    {getInitials(name)}
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">{name}</span>
                  {split.isPaid && (
                    <span className="text-[10px] bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">Paid</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-mono font-medium text-gray-900 dark:text-white">
                    {formatCurrency(split.amount, expense.currency)}
                  </span>
                  {split.percentage !== undefined && (
                    <span className="text-xs text-gray-400 ml-1">({split.percentage}%)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Add Expense Modal ──────────────────────────────────────────────────────────

function AddExpenseModal({ groupId, members, currency, onClose, onSaved }: {
  groupId: string;
  members: GroupMember[];
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const activeMembers = members.filter(m => m.status === 'active');
  const [form, setForm] = useState({
    amount: '',
    description: '',
    category: 'other' as CategoryId,
    date: new Date().toISOString().split('T')[0],
    splitType: 'equal' as 'equal' | 'exact' | 'percentage'
  });
  const [splits, setSplits] = useState<{ userId: string; name: string; amount: string; percentage: string }[]>(
    activeMembers.map(m => {
      const u = getMemberUser(m);
      return { userId: u?._id || '', name: u?.name || '', amount: '', percentage: '' };
    })
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Valid amount is required'); return; }
    if (!form.description) { setError('Description is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        amount: parseFloat(form.amount),
        description: form.description,
        category: form.category,
        date: form.date,
        splitType: form.splitType,
        currency
      };

      if (form.splitType !== 'equal') {
        payload.splits = splits.map(s => ({
          user: s.userId,
          amount: parseFloat(s.amount) || 0,
          percentage: parseFloat(s.percentage) || 0
        }));
      }

      await api.post(`/groups/${groupId}/expenses`, payload);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const totalAmount = parseFloat(form.amount) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold dark:text-white">Add Shared Expense</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-4 h-4 dark:text-gray-400" />
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount ({currency})</label>
              <input
                className="input font-mono"
                type="number" step="0.01" min="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00" required
              />
            </div>
            <div>
              <label className="label">Date</label>
              <input
                className="input"
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <input
              className="input"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What was this for?"
              required
            />
          </div>

          <div>
            <label className="label">Category</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(c => {
                const info = getCategoryInfo(c);
                const selected = form.category === c;
                return (
                  <button
                    key={c} type="button"
                    onClick={() => setForm(f => ({ ...f, category: c }))}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs transition-all ${
                      selected
                        ? 'ring-2 ring-gray-900 dark:ring-gray-400 bg-gray-50 dark:bg-gray-700 font-medium'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span className="text-lg">{info.icon}</span>
                    <span className="truncate w-full text-center dark:text-gray-300" style={{ fontSize: '10px' }}>{info.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Split Type</label>
            <div className="flex gap-2">
              {(['equal', 'exact', 'percentage'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, splitType: t }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                    form.splitType === t
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {form.splitType !== 'equal' && (
            <div className="space-y-2">
              <label className="label">
                {form.splitType === 'exact' ? 'Split Amounts' : 'Split Percentages'}
              </label>
              {splits.map((split, i) => (
                <div key={split.userId} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {getInitials(split.name)}
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{split.name}</span>
                  <input
                    className="input w-28 font-mono"
                    type="number" step="0.01" min="0"
                    placeholder={form.splitType === 'percentage' ? '%' : '0.00'}
                    value={form.splitType === 'percentage' ? split.percentage : split.amount}
                    onChange={e => setSplits(prev => prev.map((s, idx) =>
                      idx === i
                        ? { ...s, [form.splitType === 'percentage' ? 'percentage' : 'amount']: e.target.value }
                        : s
                    ))}
                  />
                </div>
              ))}
              {form.splitType === 'exact' && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Total: {formatCurrency(splits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0), currency)} / {formatCurrency(totalAmount, currency)}
                </div>
              )}
              {form.splitType === 'percentage' && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Total: {splits.reduce((s, sp) => s + (parseFloat(sp.percentage) || 0), 0).toFixed(1)}% / 100%
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Settle Up Modal ────────────────────────────────────────────────────────────

function SettleUpModal({ groupId, balance, onClose, onSaved }: {
  groupId: string;
  balance: GroupBalance;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(balance.amount.toFixed(2));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/groups/${groupId}/settlements`, {
        paidTo: balance.to.id,
        amount: parseFloat(amount),
        note
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record settlement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold dark:text-white">Settle Up</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-4 h-4 dark:text-gray-400" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Recording payment from <span className="font-medium text-gray-900 dark:text-white">{balance.from.name}</span> to <span className="font-medium text-gray-900 dark:text-white">{balance.to.name}</span>
        </p>

        {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Amount</label>
            <input
              className="input font-mono"
              type="number" step="0.01" min="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input
              className="input"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Bank transfer"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────────

type Tab = 'expenses' | 'balances' | 'settings';

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('expenses');
  const [expensePage, setExpensePage] = useState(1);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [settlingBalance, setSettlingBalance] = useState<GroupBalance | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [editForm, setEditForm] = useState<{ name: string; description: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: group, loading: groupLoading, refetch: refetchGroup } = useGroupDetail(id!);
  const { data: expensesData, loading: expensesLoading, refetch: refetchExpenses } = useGroupExpenses(id!, expensePage);
  const { data: balancesData, loading: balancesLoading, refetch: refetchBalances } = useGroupBalances(id!);
  const { data: settlementsData, loading: settlementsLoading, refetch: refetchSettlements } = useGroupSettlements(id!);

  if (groupLoading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-6 h-6 border-2 border-gray-900 dark:border-gray-100 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Group not found.</p>
        <button onClick={() => navigate('/groups')} className="btn-secondary mt-4">Back to Groups</button>
      </div>
    );
  }

  const currentUserMember = group.members.find(m => {
    const u = getMemberUser(m);
    return u && u._id === user?.id;
  });
  const currentRole = currentUserMember?.role;
  const isOwner = currentRole === 'owner';
  const isOwnerOrAdmin = currentRole === 'owner' || currentRole === 'admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    try {
      await api.post(`/groups/${id}/members`, { email: inviteEmail.trim() });
      setInviteEmail('');
      refetchGroup();
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member?')) return;
    try {
      await api.put(`/groups/${id}/members/${userId}/remove`, {});
      refetchGroup();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    setSaving(true);
    try {
      await api.put(`/groups/${id}`, editForm);
      refetchGroup();
      setEditForm(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await api.delete(`/groups/${id}`);
      navigate('/groups');
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    if (!confirm('Leave this group?')) return;
    try {
      await api.put(`/groups/${id}/members/${user.id}/remove`, {});
      navigate('/groups');
    } catch (err) {
      console.error(err);
    }
  };

  const summary = balancesData?.summary;
  const balances = balancesData?.balances || [];
  const settlements = settlementsData?.settlements || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/groups')}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold dark:text-white">{group.name}</h2>
          {group.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{group.description}</p>
          )}
        </div>
        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-lg">
          {group.currency}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {([
          { key: 'expenses', label: 'Expenses', icon: Receipt },
          { key: 'balances', label: 'Balances', icon: Scale },
          { key: 'settings', label: 'Settings', icon: Settings }
        ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Expenses Tab */}
      {tab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddExpense(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Shared Expense
            </button>
          </div>

          {expensesLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-gray-900 dark:border-gray-100 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !expensesData?.expenses.length ? (
            <div className="text-center py-16 text-gray-400">
              <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No shared expenses yet</p>
            </div>
          ) : (
            <div className="card dark:bg-gray-800 dark:border-gray-700 space-y-0 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
              {expensesData.expenses.map(expense => (
                <ExpenseCard
                  key={expense._id}
                  expense={expense}
                  groupId={id!}
                  onDeleted={() => { refetchExpenses(); refetchBalances(); }}
                  isOwnerAdmin={isOwnerOrAdmin}
                />
              ))}
            </div>
          )}

          {expensesData && expensesData.pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setExpensePage(p => Math.max(1, p - 1))}
                disabled={expensePage === 1}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {expensePage} of {expensesData.pagination.pages}
              </span>
              <button
                onClick={() => setExpensePage(p => Math.min(expensesData.pagination.pages, p + 1))}
                disabled={expensePage === expensesData.pagination.pages}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Balances Tab */}
      {tab === 'balances' && (
        <div className="space-y-5">
          {/* Summary cards */}
          {balancesLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-gray-900 dark:border-gray-100 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Group Spend', value: summary?.totalGroupSpend || 0, icon: DollarSign, color: 'text-gray-700 dark:text-gray-300' },
                  { label: 'Your Share', value: summary?.yourShare || 0, icon: Receipt, color: 'text-blue-600 dark:text-blue-400' },
                  { label: 'You Owe', value: summary?.youOwe || 0, icon: TrendingDown, color: 'text-red-600 dark:text-red-400' },
                  { label: "You're Owed", value: summary?.youAreOwed || 0, icon: TrendingUp, color: 'text-green-600 dark:text-green-400' }
                ].map(stat => (
                  <div key={stat.label} className="card p-4 dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <stat.icon className={`w-4 h-4 ${stat.color}`} />
                      <span className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</span>
                    </div>
                    <div className={`text-lg font-bold font-mono ${stat.color}`}>
                      {formatCurrency(stat.value, group.currency)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Simplified debts */}
              {balances.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Who Owes What</h3>
                  <div className="space-y-2">
                    {balances.map((balance, i) => {
                      const isMyDebt = balance.from.id === user?.id;
                      return (
                        <div key={i} className="card p-4 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between">
                          <div className="text-sm">
                            <span className={`font-medium ${isMyDebt ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                              {balance.from.name}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 mx-2">owes</span>
                            <span className="font-medium text-gray-900 dark:text-white">{balance.to.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-mono font-bold ${isMyDebt ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                              {formatCurrency(balance.amount, group.currency)}
                            </span>
                            {isMyDebt && (
                              <button
                                onClick={() => setSettlingBalance(balance)}
                                className="text-xs btn-primary py-1 px-3"
                              >
                                Settle Up
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {balances.length === 0 && (
                <div className="card p-8 text-center dark:bg-gray-800 dark:border-gray-700 text-gray-400">
                  <Scale className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">All settled up!</p>
                </div>
              )}

              {/* Settlement history */}
              {!settlementsLoading && settlements.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Settlement History</h3>
                  <div className="space-y-2">
                    {settlements.map((s: Settlement) => (
                      <div key={s._id} className="card p-3 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between">
                        <div className="text-sm">
                          <span className="font-medium text-gray-900 dark:text-white">{s.paidBy.name}</span>
                          <span className="text-gray-500 dark:text-gray-400 mx-2">paid</span>
                          <span className="font-medium text-gray-900 dark:text-white">{s.paidTo.name}</span>
                          {s.note && <span className="text-gray-400 dark:text-gray-500 ml-2">· {s.note}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-green-600 dark:text-green-400">
                            {formatCurrency(s.amount, s.currency)}
                          </span>
                          <span className="text-xs text-gray-400">{formatDate(s.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="space-y-5 max-w-xl">
          {/* Group details */}
          {isOwnerOrAdmin && (
            <div className="card p-5 dark:bg-gray-800 dark:border-gray-700 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Group Details</h3>
              {editForm ? (
                <form onSubmit={handleSaveSettings} className="space-y-3">
                  <div>
                    <label className="label">Name</label>
                    <input
                      className="input"
                      value={editForm.name}
                      onChange={e => setEditForm(f => f ? { ...f, name: e.target.value } : f)}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <input
                      className="input"
                      value={editForm.description}
                      onChange={e => setEditForm(f => f ? { ...f, description: e.target.value } : f)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setEditForm(null)} className="btn-secondary flex-1">Cancel</button>
                    <button type="submit" disabled={saving} className="btn-primary flex-1">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Name</div>
                    <div className="text-sm font-medium dark:text-white">{group.name}</div>
                  </div>
                  {group.description && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Description</div>
                      <div className="text-sm dark:text-gray-300">{group.description}</div>
                    </div>
                  )}
                  <button
                    onClick={() => setEditForm({ name: group.name, description: group.description || '' })}
                    className="btn-secondary text-sm mt-2"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Members */}
          <div className="card p-5 dark:bg-gray-800 dark:border-gray-700 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Members ({group.members.length})</h3>
            <div className="space-y-2">
              {group.members.map((m, i) => {
                const u = getMemberUser(m);
                if (!u) return null;
                const isCurrentUser = u._id === user?.id;
                const canRemove = isOwnerOrAdmin || isCurrentUser;
                return (
                  <div key={m._id || i} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white text-xs font-bold`}>
                      {getInitials(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium dark:text-white truncate">
                        {u.name} {isCurrentUser && <span className="text-gray-400">(you)</span>}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                        m.status === 'invited'
                          ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                          : m.status === 'left'
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                          : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      }`}>
                        {m.status}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{m.role}</span>
                      {canRemove && !isCurrentUser && (
                        <button
                          onClick={() => handleRemoveMember(u._id)}
                          className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
                          title="Remove member"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {isOwnerOrAdmin && (
              <form onSubmit={handleInvite} className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    className="input pl-9"
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="Invite by email..."
                  />
                </div>
                <button type="submit" disabled={inviting} className="btn-primary">
                  {inviting ? 'Inviting...' : 'Invite'}
                </button>
              </form>
            )}
            {inviteError && (
              <p className="text-xs text-red-500 dark:text-red-400">{inviteError}</p>
            )}
          </div>

          {/* Danger zone */}
          <div className="card p-5 dark:bg-gray-800 dark:border-gray-700 border-red-200 dark:border-red-900/50 space-y-3">
            <h3 className="font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
            {!isOwner && (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium dark:text-white">Leave Group</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">You will no longer have access to this group</div>
                </div>
                <button onClick={handleLeaveGroup} className="btn-danger text-sm">Leave</button>
              </div>
            )}
            {isOwner && (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium dark:text-white">Delete Group</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">This will delete all expenses and settlements</div>
                </div>
                {deleteConfirm ? (
                  <div className="flex gap-2">
                    <button onClick={() => setDeleteConfirm(false)} className="btn-secondary text-sm">Cancel</button>
                    <button onClick={handleDeleteGroup} className="btn-danger text-sm">Confirm Delete</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-sm">Delete</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddExpense && (
        <AddExpenseModal
          groupId={id!}
          members={group.members}
          currency={group.currency}
          onClose={() => setShowAddExpense(false)}
          onSaved={() => { refetchExpenses(); refetchBalances(); refetchSettlements(); }}
        />
      )}

      {settlingBalance && (
        <SettleUpModal
          groupId={id!}
          balance={settlingBalance}
          onClose={() => setSettlingBalance(null)}
          onSaved={() => { refetchBalances(); refetchSettlements(); }}
        />
      )}
    </div>
  );
}
