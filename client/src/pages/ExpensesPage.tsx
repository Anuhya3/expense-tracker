import { useState, useRef, useEffect } from 'react';
import { useExpenses, useTags } from '../hooks/useData';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getCategoryInfo } from '../utils/format';
import { Expense, CategoryId, ReceiptScanResult } from '../types';
import {
  Plus, Search, X, ChevronLeft, ChevronRight, Trash2, Edit3,
  Download, FileText, FileSpreadsheet, Loader2, ScanLine, Sparkles
} from 'lucide-react';
import ReceiptScanner from '../components/ReceiptScanner';
import CurrencySelector from '../components/CurrencySelector';

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

export default function ExpensesPage() {
  const [page, setPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [scanDefaults, setScanDefaults] = useState<Partial<ReceiptScanResult> | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const { data, loading, refetch } = useExpenses({
    page,
    category: filterCategory || undefined,
    search: search || undefined
  });

  const buildExportQS = () => {
    const q = new URLSearchParams();
    if (filterCategory) q.set('category', filterCategory);
    if (search) q.set('search', search);
    return q.toString() ? `?${q.toString()}` : '';
  };

  const handleExport = async (type: 'csv' | 'pdf') => {
    setExporting(type);
    try {
      const qs = buildExportQS();
      const today = new Date().toISOString().split('T')[0];
      await api.download(
        `/expenses/export/${type}${qs}`,
        `expenses-${today}.${type}`
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${id}`);
    refetch();
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingExpense(null);
    setScanDefaults(null);
    setShowModal(true);
  };

  const handleScanResult = (result: ReceiptScanResult) => {
    setShowScanner(false);
    setEditingExpense(null);
    setScanDefaults(result);
    setShowModal(true);
  };

  const handleSave = async () => {
    setShowModal(false);
    setEditingExpense(null);
    setScanDefaults(null);
    refetch();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold dark:text-white">Expenses</h2>
        <div className="flex items-center gap-2">
          {/* Export buttons */}
          <button
            onClick={() => handleExport('csv')}
            disabled={!!exporting}
            className="btn-secondary flex items-center gap-2 text-sm"
            title="Export CSV"
          >
            {exporting === 'csv'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <FileSpreadsheet className="w-4 h-4" />
            }
            CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={!!exporting}
            className="btn-secondary flex items-center gap-2 text-sm"
            title="Export PDF"
          >
            {exporting === 'pdf'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <FileText className="w-4 h-4" />
            }
            PDF
          </button>
          <button
            onClick={() => setShowScanner(true)}
            className="btn-secondary flex items-center gap-2 text-sm"
            title="Scan a receipt with AI"
          >
            <ScanLine className="w-4 h-4" /> Scan Receipt
          </button>
          <button onClick={handleAdd} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Search expenses..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-full sm:w-48"
          value={filterCategory}
          onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
        >
          <option value="">All categories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{getCategoryInfo(c).label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-gray-900 dark:border-gray-100 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data?.expenses.length ? (
          <div className="text-center py-16 text-gray-400">
            <Download className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No expenses found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.map(exp => {
                    const info = getCategoryInfo(exp.category);
                    const hasForeignCurrency = exp.currency && exp.currency !== 'GBP' && exp.originalAmount;
                    return (
                      <tr key={exp._id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-gray-900 dark:text-gray-100">{exp.description}</span>
                            {exp.isRecurring && (
                              <span className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md font-medium">
                                Recurring
                              </span>
                            )}
                            {exp.splits && exp.splits.length > 0 && (
                              <span className="text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-md font-medium">
                                Split
                              </span>
                            )}
                          </div>
                          {exp.tags && exp.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {exp.tags.map(tag => (
                                <span key={tag} className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-md">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg"
                            style={{ backgroundColor: info.color + '15', color: info.color }}
                          >
                            <span>{info.icon}</span> {info.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{formatDate(exp.date)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="font-mono font-medium dark:text-gray-200">{formatCurrency(exp.amount)}</div>
                          {hasForeignCurrency && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                              ({formatCurrency(exp.originalAmount!, exp.currency)})
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEdit(exp)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(exp._id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {data.pagination.total} expenses · Page {data.pagination.page} of {data.pagination.pages}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4 dark:text-gray-300" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
                    disabled={page === data.pagination.pages}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4 dark:text-gray-300" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Receipt Scanner */}
      {showScanner && (
        <ReceiptScanner
          onUseResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <ExpenseModal
          expense={editingExpense}
          defaultValues={scanDefaults}
          onClose={() => { setShowModal(false); setEditingExpense(null); setScanDefaults(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ── Modal component ──────────────────────────────────────────────

function ExpenseModal({ expense, defaultValues, onClose, onSave }: {
  expense: Expense | null;
  defaultValues?: Partial<ReceiptScanResult> | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const isEdit = !!expense;
  const { data: tagsData } = useTags();
  const existingTags = tagsData?.tags || [];

  const [form, setForm] = useState({
    amount: expense?.amount?.toString() || defaultValues?.amount?.toString() || '',
    description: expense?.description || defaultValues?.description || '',
    category: (expense?.category || defaultValues?.category || 'food') as CategoryId,
    date: expense?.date
      ? new Date(expense.date).toISOString().split('T')[0]
      : defaultValues?.date || new Date().toISOString().split('T')[0],
    paymentMethod: expense?.paymentMethod || 'debit_card',
    isRecurring: expense?.isRecurring || false,
    currency: expense?.currency || 'GBP'
  });

  // Currency conversion preview
  const [conversionPreview, setConversionPreview] = useState<{ convertedAmount: number; rate: number } | null>(null);
  const [conversionLoading, setConversionLoading] = useState(false);
  const conversionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced conversion preview
  useEffect(() => {
    if (form.currency === 'GBP' || !form.amount || parseFloat(form.amount) <= 0) {
      setConversionPreview(null);
      return;
    }
    if (conversionDebounceRef.current) clearTimeout(conversionDebounceRef.current);
    conversionDebounceRef.current = setTimeout(async () => {
      setConversionLoading(true);
      try {
        const result = await api.get<{ convertedAmount: number; rate: number }>(
          `/currencies/convert?from=${form.currency}&to=GBP&amount=${form.amount}`
        );
        setConversionPreview(result);
      } catch {
        setConversionPreview(null);
      } finally {
        setConversionLoading(false);
      }
    }, 600);
    return () => { if (conversionDebounceRef.current) clearTimeout(conversionDebounceRef.current); };
  }, [form.currency, form.amount]);

  // AI auto-categoriser state
  const [aiCategory, setAiCategory] = useState<{ category: CategoryId; confidence: number } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [manuallySelected, setManuallySelected] = useState(!!expense || !!defaultValues?.category);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tags, setTags] = useState<string[]>(expense?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  const [splitEnabled, setSplitEnabled] = useState(!!(expense?.splits?.length));
  const [splits, setSplits] = useState<{ label: string; amount: string }[]>(
    expense?.splits?.map(s => ({ label: s.label, amount: s.amount.toString() })) ||
    [{ label: '', amount: '' }, { label: '', amount: '' }]
  );

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Debounced AI auto-categorise on description change
  useEffect(() => {
    if (manuallySelected || form.description.length < 3) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setAiLoading(true);
      try {
        const res = await api.post<{ data: { category: CategoryId; confidence: number } }>(
          '/ai/categorise',
          { description: form.description }
        );
        if (!manuallySelected) {
          setAiCategory(res.data);
          setForm(f => ({ ...f, category: res.data.category }));
        }
      } catch {
        // silently ignore
      } finally {
        setAiLoading(false);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form.description, manuallySelected]);

  const tagSuggestions = existingTags.filter(
    t => t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t)
  );

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setTagInput('');
    setShowTagSuggestions(false);
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (tagInput.trim()) addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const totalAmount = parseFloat(form.amount) || 0;
  const splitTotal = splits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0);
  const splitValid = !splitEnabled || Math.abs(splitTotal - totalAmount) < 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitValid) { setError('Split amounts must sum to the total expense amount.'); return; }
    setError('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        amount: parseFloat(form.amount),
        currency: form.currency,
        tags,
        splits: splitEnabled ? splits.map(s => ({ label: s.label, amount: parseFloat(s.amount) || 0 })) : []
      };
      if (isEdit) {
        await api.put(`/expenses/${expense._id}`, payload);
      } else {
        await api.post('/expenses', payload);
      }
      onSave();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold dark:text-gray-100">{isEdit ? 'Edit Expense' : 'Add Expense'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-4 h-4 dark:text-gray-400" />
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount</label>
              <div className="flex gap-2">
                <input
                  className="input font-mono flex-1 min-w-0"
                  type="number" step="0.01" min="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00" required
                />
                <CurrencySelector
                  value={form.currency}
                  onChange={code => setForm(f => ({ ...f, currency: code }))}
                />
              </div>
              {/* Conversion preview */}
              {form.currency !== 'GBP' && form.amount && parseFloat(form.amount) > 0 && (
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {conversionLoading ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Converting...
                    </span>
                  ) : conversionPreview ? (
                    <span>
                      ≈ {formatCurrency(conversionPreview.convertedAmount)} · 1 {form.currency} = {conversionPreview.rate.toFixed(4)} GBP
                    </span>
                  ) : null}
                </div>
              )}
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
            <div className="flex items-center justify-between">
              <label className="label">Description</label>
              {aiLoading && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                  <Sparkles className="w-3 h-3 animate-pulse" /> AI categorising...
                </span>
              )}
              {aiCategory && !aiLoading && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                  <Sparkles className="w-3 h-3" /> AI: {Math.round(aiCategory.confidence * 100)}% confident
                </span>
              )}
            </div>
            <input
              className="input"
              value={form.description}
              onChange={e => { setManuallySelected(false); setAiCategory(null); setForm(f => ({ ...f, description: e.target.value })); }}
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
                    onClick={() => { setManuallySelected(true); setForm(f => ({ ...f, category: c })); }}
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
            <select className="input" value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
              {PAYMENT_METHODS.map(pm => (
                <option key={pm.id} value={pm.id}>{pm.label}</option>
              ))}
            </select>
          </div>

          {/* Tags input */}
          <div className="relative">
            <label className="label">Tags</label>
            <div className="input flex flex-wrap gap-1.5 min-h-[42px] cursor-text" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}>
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-lg">
                  #{tag}
                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                className="flex-1 min-w-[80px] bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
                placeholder={tags.length ? '' : 'Type a tag, press Enter'}
                value={tagInput}
                onChange={e => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                onKeyDown={handleTagKeyDown}
                onFocus={() => setShowTagSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
              />
            </div>
            {showTagSuggestions && tagSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 overflow-hidden">
                {tagSuggestions.slice(0, 5).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    onClick={() => addTag(tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recurring checkbox */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-gray-600 dark:text-gray-400">This is a recurring expense</span>
          </label>

          {/* Split toggle */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={splitEnabled}
                onChange={e => setSplitEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-gray-600 dark:text-gray-400 font-medium">Split this expense</span>
            </label>

            {splitEnabled && (
              <div className="mt-3 space-y-2">
                {splits.map((split, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      className="input flex-1"
                      placeholder="Label (e.g. My share)"
                      value={split.label}
                      onChange={e => setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, label: e.target.value } : s))}
                    />
                    <input
                      className="input w-28 font-mono"
                      type="number" step="0.01" min="0"
                      placeholder="0.00"
                      value={split.amount}
                      onChange={e => setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, amount: e.target.value } : s))}
                    />
                    {splits.length > 2 && (
                      <button type="button" onClick={() => setSplits(prev => prev.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSplits(prev => [...prev, { label: '', amount: '' }])}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add split
                </button>
                <div className={`text-xs ${splitValid ? 'text-gray-400 dark:text-gray-500' : 'text-red-500'}`}>
                  Total splits: £{splitTotal.toFixed(2)} / £{totalAmount.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
