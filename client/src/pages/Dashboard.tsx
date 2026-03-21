import { useState, useCallback } from 'react';
import { useSummary, useCategoryBreakdown, useTrends, useBudgetStatus } from '../hooks/useData';
import { formatCurrency, getCategoryInfo } from '../utils/format';
import { DollarSign, Receipt, Target, ArrowUpRight, ArrowDownRight, RotateCcw } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { format, parseISO } from 'date-fns';
import DashboardWidget, { WidgetDef, DEFAULT_WIDGET_ORDER } from '../components/DashboardWidget';
import InsightsPanel from '../components/InsightsPanel';
import ActivityFeed from '../components/ActivityFeed';

function loadLayout(): WidgetDef[] {
  try {
    const stored = localStorage.getItem('dashboard-layout');
    if (stored) {
      const parsed: WidgetDef[] = JSON.parse(stored);
      // Merge in any new widgets not in stored layout
      const storedIds = new Set(parsed.map(w => w.id));
      const missing = DEFAULT_WIDGET_ORDER.filter(w => !storedIds.has(w.id));
      return [...parsed, ...missing];
    }
  } catch {}
  return DEFAULT_WIDGET_ORDER;
}

export default function Dashboard() {
  const { data: summary, loading: summaryLoading } = useSummary();
  const { data: categoryData } = useCategoryBreakdown(1);
  const { data: trendsData } = useTrends(30);
  const { data: budgetData } = useBudgetStatus();

  const [widgets, setWidgets] = useState<WidgetDef[]>(loadLayout);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const handleDragStart = useCallback((id: string) => setDragging(id), []);

  const handleDragOver = useCallback((_e: React.DragEvent, id: string) => {
    if (dragging && dragging !== id) setDragOver(id);
  }, [dragging]);

  const handleDrop = useCallback((_e: React.DragEvent, targetId: string) => {
    if (!dragging || dragging === targetId) { setDragging(null); setDragOver(null); return; }
    setWidgets(prev => {
      const next = [...prev];
      const fromIdx = next.findIndex(w => w.id === dragging);
      const toIdx = next.findIndex(w => w.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      localStorage.setItem('dashboard-layout', JSON.stringify(next));
      return next;
    });
    setDragging(null);
    setDragOver(null);
  }, [dragging]);

  const resetLayout = () => {
    localStorage.removeItem('dashboard-layout');
    setWidgets(DEFAULT_WIDGET_ORDER);
  };

  if (summaryLoading || !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gray-900 dark:border-gray-100 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const s = summary;
  const isOverBudget = s.currentMonth.budgetUsed > 100;
  const momChange = s.monthOverMonthChange;

  const widgetContent: Record<string, React.ReactNode> = {
    summary: (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="This Month"
          value={formatCurrency(s.currentMonth.total)}
          sub={`${s.currentMonth.count} transactions`}
          icon={<DollarSign className="w-4 h-4" />}
          accent="bg-gray-900 text-white dark:bg-white dark:text-gray-900"
        />
        <SummaryCard
          label="Month-over-Month"
          value={`${momChange > 0 ? '+' : ''}${momChange}%`}
          sub={`vs ${formatCurrency(s.lastMonth.total)} last month`}
          icon={momChange > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          accent={momChange > 0 ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'}
        />
        <SummaryCard
          label="Budget Used"
          value={`${s.currentMonth.budgetUsed}%`}
          sub={`${formatCurrency(s.currentMonth.budget - s.currentMonth.total)} remaining`}
          icon={<Target className="w-4 h-4" />}
          accent={isOverBudget ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}
        />
        <SummaryCard
          label="Today"
          value={formatCurrency(s.today.total)}
          sub={`${s.today.count} transactions`}
          icon={<Receipt className="w-4 h-4" />}
          accent="bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
        />
      </div>
    ),

    insights: <InsightsPanel />,

    trend: (
      <div className="card p-5 dark:bg-gray-800 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Spending Trend (30 days)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendsData?.trends || []} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#111827" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#111827" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(d) => format(parseISO(d), 'dd MMM')}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `£${v}`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false} tickLine={false} width={50}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Spent']}
                labelFormatter={(d) => format(parseISO(d as string), 'dd MMM yyyy')}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px', backgroundColor: 'var(--tooltip-bg, white)' }}
              />
              <Area type="monotone" dataKey="total" stroke="#111827" strokeWidth={2} fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    ),

    category: (
      <div className="card p-5 dark:bg-gray-800 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">By Category</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData?.breakdown || []}
                dataKey="total" nameKey="category"
                cx="50%" cy="50%"
                innerRadius={50} outerRadius={75} paddingAngle={2}
              >
                {(categoryData?.breakdown || []).map(entry => (
                  <Cell key={entry.category} fill={getCategoryInfo(entry.category).color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), getCategoryInfo(name).label]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
          {(categoryData?.breakdown || []).slice(0, 5).map(b => {
            const info = getCategoryInfo(b.category);
            return (
              <div key={b.category} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info.color }} />
                  <span className="text-gray-600 dark:text-gray-400">{info.label}</span>
                </div>
                <span className="font-medium dark:text-gray-200">{b.percentage}%</span>
              </div>
            );
          })}
        </div>
      </div>
    ),

    budget: budgetData?.budgetStatus?.length ? (
      <div className="card p-5 dark:bg-gray-800 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Budget Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgetData.budgetStatus.map(b => {
            const info = getCategoryInfo(b.category);
            const pct = Math.min(b.percentUsed, 100);
            return (
              <div key={b.category} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span>{info.icon}</span>
                    <span className="font-medium dark:text-gray-200">{info.label}</span>
                  </span>
                  <span className={`text-xs font-medium ${b.isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {formatCurrency(b.spent)} / {formatCurrency(b.limit)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      b.isOverBudget ? 'bg-red-500' : b.percentUsed > 80 ? 'bg-amber-500' : 'bg-gray-900 dark:bg-gray-200'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null,

    activity: <ActivityFeed />
  };

  return (
    <div className="space-y-6">
      {/* Reset layout button */}
      <div className="flex justify-end">
        <button
          onClick={resetLayout}
          className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Reset dashboard layout"
        >
          <RotateCcw className="w-3 h-3" /> Reset layout
        </button>
      </div>

      {widgets.map(widget => {
        const content = widgetContent[widget.id];
        if (!content) return null;
        return (
          <DashboardWidget
            key={widget.id}
            id={widget.id}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            isDragOver={dragOver === widget.id}
          >
            {/* Two-column layout for trend+category side by side */}
            {widget.id === 'trend' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">{widgetContent['trend']}</div>
                <div>{widgetContent['category']}</div>
              </div>
            ) : widget.id === 'category' ? null : content}
          </DashboardWidget>
        );
      })}
    </div>
  );
}

function SummaryCard({ label, value, sub, icon, accent }: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="card p-5 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</div>
    </div>
  );
}
