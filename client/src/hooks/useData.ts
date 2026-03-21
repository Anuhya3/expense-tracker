import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import {
  Expense, SummaryData, CategoryBreakdown, TrendPoint,
  BudgetStatus, Insight, RecurringExpense, Activity, TagBreakdown,
  Group, SharedExpense, GroupBalanceResponse, Settlement, Currency
} from '../types';

// Generic fetch hook
function useFetch<T>(endpoint: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<T>(endpoint)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [endpoint]);

  useEffect(() => { refetch(); }, [refetch, ...deps]);

  return { data, loading, error, refetch };
}

// Expenses with pagination
export function useExpenses(params: {
  page?: number;
  category?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
} = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.category) query.set('category', params.category);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.search) query.set('search', params.search);

  const qs = query.toString();
  return useFetch<{
    expenses: Expense[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>(`/expenses?${qs}`, [qs]);
}

export function useSummary() {
  return useFetch<SummaryData>('/analytics/summary');
}

export function useCategoryBreakdown(months = 1) {
  return useFetch<{ breakdown: CategoryBreakdown[]; total: number }>(
    `/analytics/by-category?months=${months}`, [months]
  );
}

export function useTrends(days = 30) {
  return useFetch<{ trends: TrendPoint[]; days: number }>(
    `/analytics/trends?days=${days}`, [days]
  );
}

export function useBudgetStatus() {
  return useFetch<{ budgetStatus: BudgetStatus[] }>('/analytics/budget-status');
}

export function useInsights() {
  return useFetch<{ insights: Insight[] }>('/analytics/insights');
}

export function useTagBreakdown(months = 1) {
  return useFetch<{ breakdown: TagBreakdown[]; total: number }>(
    `/analytics/by-tag?months=${months}`, [months]
  );
}

export function useRecurring() {
  return useFetch<{ recurring: RecurringExpense[] }>('/recurring');
}

export function useTags() {
  return useFetch<{ tags: string[] }>('/expenses/tags');
}

export function useActivity(limit = 20) {
  return useFetch<{
    activities: Activity[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>(`/activity?limit=${limit}`, [limit]);
}

export function useGroups() {
  return useFetch<{ groups: Group[] }>('/groups');
}

export function useGroupDetail(groupId: string) {
  return useFetch<Group>(`/groups/${groupId}`, [groupId]);
}

export function useGroupExpenses(groupId: string, page = 1) {
  return useFetch<{
    expenses: SharedExpense[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>(`/groups/${groupId}/expenses?page=${page}`, [groupId, page]);
}

export function useGroupBalances(groupId: string) {
  return useFetch<GroupBalanceResponse>(`/groups/${groupId}/balances`, [groupId]);
}

export function useGroupSettlements(groupId: string) {
  return useFetch<{ settlements: Settlement[] }>(`/groups/${groupId}/settlements`, [groupId]);
}

export function useCurrencies() {
  return useFetch<{ currencies: Currency[]; baseCurrency: string }>('/currencies');
}
