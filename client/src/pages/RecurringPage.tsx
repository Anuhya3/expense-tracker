import { useState, useCallback } from 'react';
import { useRecurring } from '../hooks/useData';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getCategoryInfo } from '../utils/format';
import { RecurringExpense, CategoryId } from '../types';
import {
  Plus, Repeat, Edit3, Trash2, X, RefreshCw,
  CheckCircle, PauseCircle, PlayCircle
} from 'lucide-react';

const CATEGORIES: CategoryId[] = [
  'food', 'transport', 'housing', 'utilities', 'entertainment',
  'healthcare', 'shopping', 'education', 'travel', 'subscriptions', 'other'
];

const PAYMENT_METHODS = [
  { id: 'debit_card', label: 'Debit Card' },
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'cash', label: 'Cash' },
  { id: 'bank_transfer', label: 'Bank Transfer' },
  { id: 'other', label: 'Other' }
];

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly'
};

const FREQ_COLORS: Record<string, string> = {
  weekly: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  monthly: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  yearly: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
};

export default function RecurringPage() {
  const { data, loading, refetch } = useRecurring();
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringExpense | null>(null);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post<{ generated: number; message: string }>('/recurring/generate', {});
      showToast(res.message);
      refetch();
    } catch (err: any) {
      showToast(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggle = async (item: RecurringExpense) => {
    try {
      await api.put(`/recurring/${item._id}`, { isActive: !item.isActive });
      refetch();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring expense?')) return;
    try {
      await api.delete(`/recurring/${id}`);
      refetch();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleEdit = (item: RecurringExpense) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleSave = () => {
    setShowModal(false);
    setEditingItem(null);
    refetch();
  };

  const recurring = data?.recurring || [];
  const active = recurring.filter(r => r.isActive);
  const paused = recurring.filter(r => !r.isActive);

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-green-400" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold dark:text-gray-100">Recurring Expenses</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {active.length} active · {paused.length} paused
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            Generate Now
          </button>
          <button
            onClick={() => { setEditingItem(null); setShowModal(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Recurring
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !recurring.length ? (
        <div className="card p-16 text-center dark:bg-gray-800 dark:border-gray-700">
          <Repeat className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-400 dark:text-gray-500">No recurring expenses yet</p>
          <button
            onClick={() => { setEditingItem(null); setShowModal(true); }}
            className="btn-primary mt-4"
          >
            Add your first recurring expense
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recurring.map(item => {
            const info = getCategoryInfo(item.category);
            return (
              <div
                key={item._id}
                className={`card p-5 dark:bg-gray-800 dark:border-gray-700 transition-opacity ${
                  item.isActive ? '' : 'opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: info.color + '20' }}
                    >
                      {info.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                        {item.description}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{info.label}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item._id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-3">
                  {formatCurrency(item.amount)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${FREQ_COLORS[item.frequency]}`}>
                      {FREQ_LABELS[item.frequency]}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Due {formatDate(item.nextDueDate)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggle(item)}
                    className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                      item.isActive
                        ? 'text-green-600 dark:text-green-400 hover:text-amber-600 dark:hover:text-amber-400'
                        : 'text-gray-400 hover:text-green-600 dark:hover:text-green-400'
                    }`}
                    title={item.isActive ? 'Pause' : 'Resume'}
                  >
                    {item.isActive
                      ? <><PauseCircle className="w-4 h-4" /> Active</>
                      : <><PlayCircle className="w-4 h-4" /> Paused</>
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <RecurringModal
          item={editingItem}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function RecurringModal({ item, onClose, onSave }: {
  item: RecurringExpense | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const isEdit = !!item;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);

  const [form, setForm] = useState({
    amount: item?.amount?.toString() || '',
    description: item?.description || '',
    category: item?.category || 'subscriptions' as CategoryId,
    paymentMethod: item?.paymentMethod || 'debit_card',
    frequency: item?.frequency || 'monthly',
    nextDueDate: item?.nextDueDate
      ? new Date(item.nextDueDate).toISOString().split('T')[0]
      : tomorrow.toISOString().split('T')[0]
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { ...form, amount: parseFloat(form.amount) };
      if (isEdit) {
        await api.put(`/recurring/${item._id}`, payload);
      } else {
        await api.post('/recurring', payload);
      }
      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold dark:text-gray-100">
            {isEdit ? 'Edit Recurring' : 'Add Recurring Expense'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-4 h-4 dark:text-gray-400" />
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (£)</label>
              <input
                className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                type="number" step="0.01" min="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00" required
              />
            </div>
            <div>
              <label className="label">Frequency</label>
              <select
                className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={form.frequency}
                onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <input
              className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Netflix subscription"
              required
            />
          </div>

          <div>
            <label className="label">Next Due Date</label>
            <input
              className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              type="date"
              value={form.nextDueDate}
              onChange={e => setForm(f => ({ ...f, nextDueDate: e.target.value }))}
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
            <label className="label">Payment Method</label>
            <select
              className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={form.paymentMethod}
              onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
            >
              {PAYMENT_METHODS.map(pm => (
                <option key={pm.id} value={pm.id}>{pm.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Recurring'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
