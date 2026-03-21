import { useInsights } from '../hooks/useData';
import {
  AlertTriangle, TrendingUp, TrendingDown, Repeat,
  BarChart2, CheckCircle, Zap, Info
} from 'lucide-react';
import { Insight } from '../types';

const ICON_MAP: Record<string, React.ElementType> = {
  'alert-triangle': AlertTriangle,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'repeat': Repeat,
  'bar-chart-2': BarChart2,
  'check-circle': CheckCircle,
  'zap': Zap,
  'info': Info
};

const TYPE_STYLES: Record<Insight['type'], { border: string; bg: string; icon: string; badge: string }> = {
  warning: {
    border: 'border-l-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    icon: 'text-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
  },
  info: {
    border: 'border-l-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    icon: 'text-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
  },
  success: {
    border: 'border-l-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    icon: 'text-green-500',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
  }
};

export default function InsightsPanel() {
  const { data, loading } = useInsights();

  if (loading) return null;
  if (!data?.insights.length) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Smart Insights</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.insights.map((insight, i) => {
          const styles = TYPE_STYLES[insight.type];
          const Icon = ICON_MAP[insight.icon] || Info;
          return (
            <div
              key={i}
              className={`rounded-xl border-l-4 ${styles.border} ${styles.bg} p-4 flex gap-3`}
            >
              <div className={`mt-0.5 flex-shrink-0 ${styles.icon}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight">{insight.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${styles.badge}`}>
                    {insight.type}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{insight.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
