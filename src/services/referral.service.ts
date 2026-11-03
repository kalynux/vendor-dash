import { api } from './api';
import type { EarningsPage } from '@/types/earnings.types';
import type {
  ReferralOverview,
  ReferralPayout,
  ReferralReward,
  ReferredAccount,
} from '@/types/referral.types';

// api-doc/me/referrals.md (2026-11-02).
//
// ⚠ Separate money from `earnings.service`: a partner's balance has its own
// withdrawal and its own lower minimum. The server finds the partner from the
// session, so nothing vendor-specific is sent.

const BASE = '/me/referral';

interface ReferralResponse<T> {
  success: boolean;
  data: T;
}

interface ReferralListResponse<T> {
  success: boolean;
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export async function fetchReferralOverview(): Promise<ReferralOverview> {
  const res = await api.get<ReferralResponse<ReferralOverview>>(BASE);
  return res.data;
}

/** `termsAccepted` is literally `true`: accepting the Partner Terms is what an application is. */
export async function applyToReferralProgram(motivation: string): Promise<void> {
  await api.post(`${BASE}/application`, {
    termsAccepted: true,
    ...(motivation ? { motivation } : {}),
  });
}

/** `totalPages` here, `pages` on the earnings lists: mapped so both can share one list. */
async function fetchPage<T>(path: string, page: number, limit: number): Promise<EarningsPage<T>> {
  const res = await api.get<ReferralListResponse<T>>(`${BASE}${path}?page=${page}&limit=${limit}`);
  const { total, totalPages } = res.meta;
  return { items: res.data, meta: { total, page: res.meta.page, limit: res.meta.limit, pages: totalPages } };
}

export function fetchReferredAccounts(page = 1, limit = 10): Promise<EarningsPage<ReferredAccount>> {
  return fetchPage<ReferredAccount>('/referred', page, limit);
}

export function fetchReferralRewards(page = 1, limit = 10): Promise<EarningsPage<ReferralReward>> {
  return fetchPage<ReferralReward>('/rewards', page, limit);
}

export function fetchReferralPayouts(page = 1, limit = 10): Promise<EarningsPage<ReferralPayout>> {
  return fetchPage<ReferralPayout>('/payouts', page, limit);
}

/** No body: withdraws the whole available balance. */
export async function requestReferralPayout(): Promise<void> {
  await api.post(`${BASE}/payout`);
}
