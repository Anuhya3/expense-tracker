import { format, parseISO, isToday, isYesterday } from 'date-fns';

export function formatCurrency(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

export function formatDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd MMM yyyy');
}

export function formatShortDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd MMM');
}

export function getCategoryInfo(categoryId: string) {
  const map: Record<string, { label: string; icon: string; color: string }> = {
    food: { label: 'Food & Dining', icon: '🍔', color: '#f97316' },
    transport: { label: 'Transport', icon: '🚗', color: '#3b82f6' },
    housing: { label: 'Housing', icon: '🏠', color: '#8b5cf6' },
    utilities: { label: 'Utilities', icon: '💡', color: '#eab308' },
    entertainment: { label: 'Entertainment', icon: '🎬', color: '#ec4899' },
    healthcare: { label: 'Healthcare', icon: '🏥', color: '#14b8a6' },
    shopping: { label: 'Shopping', icon: '🛍️', color: '#f43f5e' },
    education: { label: 'Education', icon: '📚', color: '#6366f1' },
    travel: { label: 'Travel', icon: '✈️', color: '#0ea5e9' },
    subscriptions: { label: 'Subscriptions', icon: '📱', color: '#a855f7' },
    other: { label: 'Other', icon: '📌', color: '#64748b' }
  };
  return map[categoryId] || map.other;
}
