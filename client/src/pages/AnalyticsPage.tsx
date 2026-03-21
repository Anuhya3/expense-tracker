import { useState } from 'react';
import { useCategoryBreakdown, useTrends, useTagBreakdown } from '../hooks/useData';
import { formatCurrency, getCategoryInfo } from '../utils/format';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid
} from 'recharts';
import { format, parseISO } from 'date-fns';

type Tab = 'category' | 'trends' | 'tags';

const TAG_COLORS = [
  '#6366f1', '#f97316', '#14b8a6', '#ec4899', '#eab308',
  '#3b82f6', '#8b5cf6', '#f43f5e', '#0ea5e9', '#a855f7'
];

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('category');
  const [months, setMonths] = useState(1);
  const [days, setDays] = useState(30);
  const { data: catData, loading: catLoading } = useCategoryBreakdown(months);
  const { data: trendsData, loading: trendsLoading } = useTrends(days);
  const { data: tagData, loading: tagLoading } = useTagBreakdown(months);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold dark:text-white">Analytics</h2>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          {([
            { id: 'category', label: 'Category' },
            { id: 'trends', label: 'Trends' },
            { id: 'tags', label: 'By Tag' }
          ] as { id: Tab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                tab === t.id
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category breakdown bar chart */}
      {tab === 'category' && (
        <>
          <div className="card p-5 dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Spending by Category</h3>
              <div className="flex gap-1">
                {[1, 3, 6].map(m => (
                  <button
                    key={m}
                    onClick={() => setMonths(m)}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      months === m
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {m}M
                  </button>
                ))}
              </div>
            </div>
            {catLoading ? (
              <div className="h-72 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-900 dark:border-gray-100 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={catData?.breakdown || []} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <XAxis type="number" tickFormatter={v => `£${v}`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category" dataKey="category"
                      tickFormatter={c => getCategoryInfo(c).label}
                      tick={{ fontSize: 12, fill: '#374151' }}
                      axisLine={false} tickLine={false} width={75}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Total']}
                      labelFormatter={c => getCategoryInfo(c as string).label}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                    />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={20}>
                      {(catData?.breakdown || []).map(entry => (
                        <Cell key={entry.category} fill={getCategoryInfo(entry.category).color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {catData && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                Total: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(catData.total)}</span> across{' '}
                {catData.breakdown.length} categories
              </div>
            )}
          </div>

          {/* Category table */}
          <div className="card overflow-hidden dark:bg-gray-800 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg / txn</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Count</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Share</th>
                </tr>
              </thead>
              <tbody>
                {(catData?.breakdown || []).map(b => {
                  const info = getCategoryInfo(b.category);
                  return (
                    <tr key={b.category} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2">
                          <span>{info.icon}</span>
                          <span className="font-medium dark:text-gray-200">{info.label}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-medium dark:text-gray-200">{formatCurrency(b.total)}</td>
                      <td className="px-5 py-3 text-right font-mono text-gray-500 dark:text-gray-400">{formatCurrency(b.avg)}</td>
                      <td className="px-5 py-3 text-right text-gray-500 dark:text-gray-400">{b.count}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${b.percentage}%`, backgroundColor: info.color }} />
                          </div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-10 text-right">{b.percentage}%</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Trends */}
      {tab === 'trends' && (
        <div className="card p-5 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Daily Spending Trends</h3>
            <div className="flex gap-1">
              {[7, 14, 30, 60].map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    days === d
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {d}D
                </button>
              ))}
            </div>
          </div>
          {trendsLoading ? (
            <div className="h-72 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-gray-900 dark:border-gray-100 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsData?.trends || []} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={d => format(parseISO(d), 'dd MMM')}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tickFormatter={v => `£${v}`}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false} tickLine={false} width={50}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Spent']}
                    labelFormatter={d => format(parseISO(d as string), 'dd MMM yyyy')}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="#111827" strokeWidth={2} dot={{ fill: '#111827', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* By Tag */}
      {tab === 'tags' && (
        <>
          <div className="card p-5 dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Spending by Tag</h3>
              <div className="flex gap-1">
                {[1, 3, 6].map(m => (
                  <button
                    key={m}
                    onClick={() => setMonths(m)}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      months === m
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {m}M
                  </button>
                ))}
              </div>
            </div>
            {tagLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-900 dark:border-gray-100 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !tagData?.breakdown.length ? (
              <div className="h-40 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                No tagged expenses in this period. Add tags to your expenses to see breakdown here.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tagData?.breakdown || []} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <XAxis type="number" tickFormatter={v => `£${v}`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category" dataKey="tag"
                      tick={{ fontSize: 12, fill: '#374151' }}
                      axisLine={false} tickLine={false} width={75}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Total']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                    />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={20}>
                      {(tagData?.breakdown || []).map((_, i) => (
                        <Cell key={i} fill={TAG_COLORS[i % TAG_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {tagData?.breakdown.length ? (
            <div className="card overflow-hidden dark:bg-gray-800 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tag</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Count</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {tagData.breakdown.map((b, i) => (
                    <tr key={b.tag} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg"
                          style={{ backgroundColor: TAG_COLORS[i % TAG_COLORS.length] + '20', color: TAG_COLORS[i % TAG_COLORS.length] }}>
                          #{b.tag}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-medium dark:text-gray-200">{formatCurrency(b.total)}</td>
                      <td className="px-5 py-3 text-right text-gray-500 dark:text-gray-400">{b.count}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${b.percentage}%`, backgroundColor: TAG_COLORS[i % TAG_COLORS.length] }} />
                          </div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-10 text-right">{b.percentage}%</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
