import { api } from './api';
import type {
  Transaction,
  TransactionsListMeta,
  TransactionsQueryParams,
  TransactionsResponse,
} from '@/types/transactions.types';

const BASE = '/vendor';

// Reuses the billing/products service query-string convention: drop empty values.
function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

/**
 * Unified, newest-first transaction feed (plans, credits, earnings, payouts).
 * Replaces the removed `/credits/ledger`, `/credits/topups`, `/plan-purchases`
 * and `/earnings/ledger` histories. Pass `category` to power sub-tabs.
 */
export async function fetchTransactions(
  params: TransactionsQueryParams = {},
): Promise<{ data: Transaction[]; meta: TransactionsListMeta }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<TransactionsResponse>(`${BASE}/transactions${qs}`);
  return { data: res.data, meta: res.meta };
}
