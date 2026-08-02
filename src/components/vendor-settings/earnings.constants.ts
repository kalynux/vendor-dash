// ─── Vendor Earnings — display constants & helpers ───────────────────────────

import { ApiError } from '@/types/api';
import type { PayoutOrigin, PayoutRequestStatus } from '@/types/earnings.types';

export const PAYOUT_STATUS_LABELS: Record<PayoutRequestStatus, string> = {
  pending: 'Pending review',
  paid: 'Paid',
  rejected: 'Rejected',
};

// ─── Server-side payout thresholds ────────────────────────────────────────────
// Both are backend config (`EARNINGS_CONFIG`) with no endpoint exposing them, so
// they're mirrored here from api-doc/vendor/earnings.md. They gate UX only — the
// backend re-checks and answers `EARNINGS_PAYOUT_BELOW_MINIMUM` either way.

/** `available` must reach this before a payout can be requested (XAF). */
export const MIN_PAYOUT_AMOUNT = 10_000;
/** At this `available` balance the platform opens a payout request on the vendor's behalf (XAF). */
export const AUTO_PAYOUT_THRESHOLD = 2_000_000;

/** How a payout request came to exist — shown next to the request's status. */
export const PAYOUT_ORIGIN_LABELS: Record<PayoutOrigin, string> = {
  manual: 'Requested by you',
  auto_threshold: 'Automatic',
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
  EARNINGS_PAYOUT_BELOW_MINIMUM: `Your available balance is below the ${new Intl.NumberFormat().format(MIN_PAYOUT_AMOUNT)} XAF minimum for a withdrawal.`,
};

export function earningsErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) {
    return EARNINGS_ERROR_MESSAGES[err.code] ?? err.message ?? fallback;
  }
  return fallback;
}
