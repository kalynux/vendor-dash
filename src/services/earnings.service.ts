import { api } from './api';
import type {
  EarningsBalance,
  PayoutRequest,
  EarningsResponse,
  PayoutRequestResponse,
  LatestPayoutResponse,
} from '@/types/earnings.types';

const BASE = '/vendor';

export async function fetchEarningsBalance(): Promise<EarningsBalance> {
  const res = await api.get<EarningsResponse>(`${BASE}/earnings`);
  return res.data;
}

/** Your most recent payout request, or `null` if none was ever made. */
export async function fetchLatestPayout(): Promise<PayoutRequest | null> {
  const res = await api.get<LatestPayoutResponse>(`${BASE}/earnings/payout`);
  return res.data;
}

/** Sweeps the entire `available` balance into a pending payout request. */
export async function requestPayout(): Promise<{ payout: PayoutRequest; message?: string }> {
  const res = await api.post<PayoutRequestResponse>(`${BASE}/earnings/payout`);
  return { payout: res.data, message: res.message };
}
