// ─── Vendor Earnings — display constants & helpers ───────────────────────────

import { ApiError } from '@/types/api';
import type { PayoutRequestStatus } from '@/types/earnings.types';

export const PAYOUT_STATUS_LABELS: Record<PayoutRequestStatus, string> = {
  pending: 'Pending review',
  paid: 'Paid',
  rejected: 'Rejected',
};

export const PAYOUT_STATUS_BADGE_CLASSES: Record<PayoutRequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const EARNINGS_ERROR_MESSAGES: Record<string, string> = {
  EARNINGS_PAYOUT_ALREADY_PENDING: 'You already have a payout request in progress — track it below.',
  EARNINGS_PAYOUT_METHOD_MISSING: 'Add a payout method below before requesting a withdrawal.',
  EARNINGS_PAYOUT_NO_AVAILABLE_BALANCE: 'There is no available balance to withdraw yet.',
};

export function earningsErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) {
    return EARNINGS_ERROR_MESSAGES[err.code] ?? err.message ?? fallback;
  }
  return fallback;
}
