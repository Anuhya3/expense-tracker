import { useState } from 'react';
import { api } from '../utils/api';
import { BulkCategorizationItem, CategoryId } from '../types';
import { getCategoryInfo, formatCurrency } from '../utils/format';
import { Upload, Sparkles, CheckCircle, Loader2, Plus, AlertCircle } from 'lucide-react';

const CATEGORIES: CategoryId[] = [
  'food', 'transport', 'housing', 'utilities', 'entertainment',
  'healthcare', 'shopping', 'education', 'travel', 'subscriptions', 'other'
];

interface Row {
  description: string;
  amount: string;
  date: string;
  category: CategoryId;
  confidence: number;
}

const PLACEHOLDER = `Tesco Express — weekly groceries, 34.50, 2024-03-10
Netflix subscription, 17.99, 2024-03-01
Uber to airport, 28.40, 2024-03-05
Gym membership March, 45.00, 2024-03-01
Amazon order — headphones, 89.99, 2024-03-08`;

export default function BulkImportPage() {
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [categorising, setCategorising] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'live' | 'demo' | null>(null);

  const parseRaw = () => {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        description: parts[0] || '',
        amount: parts[1] || '',
        date: parts[2] || new Date().toISOString().split('T')[0],
        category: 'other' as CategoryId,
        confidence: 0
      };
    }).filter(r => r.description);
    setRows(parsed);
    setImportedCount(0);
    setError('');
    return parsed;
  };

  const handleCategorise = async () => {
    const parsed = parseRaw();
    if (!parsed.length) return;

    setCategorising(true);
    setError('');
    try {
      const descriptions = parsed.map(r => r.description);
      const res = await api.post<{ success: boolean; mode: 'live' | 'demo'; data: BulkCategorizationItem[] }>(
        '/ai/categorise-bulk',
        { descriptions }
      );
      setMode(res.mode);
      setRows(parsed.map((row, i) => {
        const cat = res.data.find(d => d.index === i + 1);
        return { ...row, category: (cat?.category as CategoryId) || 'other', confidence: cat?.confidence || 0 };
      }));
    } catch (err: any) {
      setError(err.message || 'Categorisation failed');
    } finally {
      setCategorising(false);
    }
  };

  const handleImport = async () => {
    const valid = rows.filter(r => r.description && parseFloat(r.amount) > 0);
    if (!valid.length) { setError('No valid rows to import.'); return; }

    setImporting(true);
    setError('');
    let count = 0;
    for (const row of valid) {
      try {
        await api.post('/expenses', {
          description: row.description,
          amount: parseFloat(row.amount),
          category: row.category,
          date: row.date,
          paymentMethod: 'other',
          isRecurring: false
        });
        count++;
      } catch {
        // continue with remaining rows
      }
    }
    setImportedCount(count);
    setImporting(false);
    if (count > 0) {
      setRows([]);
      setRaw('');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold dark:text-white">Bulk Import</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Paste expenses as CSV — one per line: <span className="font-mono text-xs">description, amount, date (YYYY-MM-DD)</span>
        </p>
      </div>

      {importedCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm rounded-xl">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {importedCount} expense{importedCount > 1 ? 's' : ''} imported successfully.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="card p-5 dark:bg-gray-800 dark:border-gray-700 space-y-4">
        <textarea
          className="input font-mono text-xs resize-none"
          rows={8}
          placeholder={PLACEHOLDER}
          value={raw}
          onChange={e => setRaw(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={handleCategorise}
            disabled={categorising || !raw.trim()}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            {categorising ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {categorising ? 'Categorising...' : 'AI Categorise'}
          </button>
          {mode && (
            <span className={`self-center text-xs px-2.5 py-1 rounded-lg font-medium ${
              mode === 'live' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            }`}>
              {mode === 'live' ? 'AI Live' : 'Demo mode'}
            </span>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="card overflow-hidden dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm font-medium dark:text-white">{rows.length} row{rows.length > 1 ? 's' : ''} ready</span>
            <button
              onClick={handleImport}
              disabled={importing}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Importing...' : `Import ${rows.length}`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const info = row.category ? getCategoryInfo(row.category) : null;
                  return (
                    <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                      <td className="px-5 py-3">
                        <input
                          className="input text-xs py-1"
                          value={row.description}
                          onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <input
                          className="input text-xs py-1 font-mono w-24"
                          type="number" step="0.01" min="0"
                          value={row.amount}
                          onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, amount: e.target.value } : r))}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <input
                          className="input text-xs py-1 w-36"
                          type="date"
                          value={row.date}
                          onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, date: e.target.value } : r))}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <select
                          className="input text-xs py-1"
                          value={row.category}
                          onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, category: e.target.value as CategoryId } : r))}
                        >
                          {CATEGORIES.map(c => (
                            <option key={c} value={c}>{getCategoryInfo(c).icon} {getCategoryInfo(c).label}</option>
                          ))}
                        </select>
                        {row.confidence > 0 && (
                          <div className="text-[10px] text-gray-400 mt-0.5">{Math.round(row.confidence * 100)}% confidence</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length === 0 && !raw.trim() && (
        <div className="card p-8 dark:bg-gray-800 dark:border-gray-700 text-center text-gray-400 dark:text-gray-500">
          <Plus className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Paste your expenses above and click AI Categorise to get started.</p>
        </div>
      )}
    </div>
  );
}
