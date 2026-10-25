import { api } from './api';
import type {
  EarningsBalance,
  PayoutRequest,
  EarningsResponse,
  PayoutRequestResponse,
  LatestPayoutResponse,
  EarningsAdjustment,
  EarningsListResponse,
  EarningsPage,
  VendorAgencyClaim,
} from '@/types/earnings.types';

const BASE = '/vendor';

export async function fetchEarningsBalance(): Promise<EarningsBalance> {
  const res = await api.get<EarningsResponse>(`${BASE}/earnings`);
  // `clawback` arrives with the 2026-10-05 refund flow; an older server leaves it out.
  return { ...res.data, clawback: res.data.clawback ?? 0 };
}

/** Your most recent payout request, or `null` if none was ever made. */
export async function fetchLatestPayout(): Promise<PayoutRequest | null> {
  const res = await api.get<LatestPayoutResponse>(`${BASE}/earnings/payout`);
  return res.data;
}

async function fetchPage<T>(path: string, page: number, limit: number): Promise<EarningsPage<T>> {
  const res = await api.get<EarningsListResponse<T>>(`${BASE}${path}?page=${page}&limit=${limit}`);
  const items = res.data ?? [];
  return {
    items,
    meta: res.meta ?? { total: items.length, page, limit, pages: 1 },
  };
}

/** Every movement that took money from you, paid off a refund debt, or forgave one — newest first. */
export function fetchEarningsAdjustments(page = 1, limit = 10): Promise<EarningsPage<EarningsAdjustment>> {
  return fetchPage<EarningsAdjustment>('/earnings/adjustments', page, limit);
}

/** Damage claims charged to an agency for your parcels — each one credited to you. */
export function fetchVendorAgencyClaims(page = 1, limit = 10): Promise<EarningsPage<VendorAgencyClaim>> {
  return fetchPage<VendorAgencyClaim>('/earnings/agency-claims', page, limit);
}

/** Sweeps the entire `available` balance into a pending payout request. */
export async function requestPayout(): Promise<{ payout: PayoutRequest; message?: string }> {
  const res = await api.post<PayoutRequestResponse>(`${BASE}/earnings/payout`);
  return { payout: res.data, message: res.message };
}
