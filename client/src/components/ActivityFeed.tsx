import { useState } from 'react';
import { useActivity } from '../hooks/useData';
import { Activity } from '../types';
import {
  Plus, Edit3, Trash2, Target, AlertTriangle, Repeat, LogIn,
  ChevronDown, ChevronUp, Activity as ActivityIcon
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

const ACTION_CONFIG: Record<Activity['action'], {
  icon: React.ElementType; color: string; label: string
}> = {
  expense_created: { icon: Plus, color: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400', label: 'Added expense' },
  expense_updated: { icon: Edit3, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400', label: 'Updated expense' },
  expense_deleted: { icon: Trash2, color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400', label: 'Deleted expense' },
  budget_set: { icon: Target, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400', label: 'Budget updated' },
  budget_exceeded: { icon: AlertTriangle, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400', label: 'Budget exceeded' },
  recurring_generated: { icon: Repeat, color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400', label: 'Recurring generated' },
  login: { icon: LogIn, color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', label: 'Signed in' }
};

function formatMeta(action: Activity['action'], meta?: Record<string, unknown>): string {
  if (!meta) return '';
  if (action === 'expense_created' || action === 'expense_updated' || action === 'expense_deleted') {
    const desc = meta.description as string || '';
    const amt = meta.amount as number;
    return `${desc}${amt ? ` · £${(amt as number).toFixed(2)}` : ''}`;
  }
  if (action === 'budget_set') return `${meta.category} · £${meta.limit}`;
  if (action === 'budget_exceeded') return `${meta.category} · spent £${meta.spent}`;
  if (action === 'recurring_generated') return `${meta.count} expense${(meta.count as number) !== 1 ? 's' : ''} generated`;
  return '';
}

export default function ActivityFeed() {
  const [expanded, setExpanded] = useState(false);
  const { data, loading } = useActivity(expanded ? 20 : 8);

  if (loading && !data) return null;
  const activities = data?.activities || [];
  if (!activities.length) return null;

  return (
    <div className="card p-5 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ActivityIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Activity</h3>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
        >
          {expanded ? 'Show less' : 'View all'}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      <div className="space-y-3">
        {activities.map(activity => {
          const cfg = ACTION_CONFIG[activity.action] || ACTION_CONFIG.login;
          const Icon = cfg.icon;
          const detail = formatMeta(activity.action, activity.metadata as Record<string, unknown>);
          const time = formatDistanceToNow(parseISO(activity.createdAt), { addSuffix: true });

          return (
            <div key={activity._id} className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{cfg.label}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{time}</span>
                </div>
                {detail && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{detail}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
