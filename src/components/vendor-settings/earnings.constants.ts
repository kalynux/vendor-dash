// ─── Vendor Earnings — display constants & helpers ───────────────────────────
//
// Labels are translation *keys*, not sentences: this module is imported by both
// the desktop and mobile payout surfaces and has no React context of its own, so
// each call site resolves them with `t` and they follow a language switch.

import { apiErrorMessage, type TranslationKey } from '@/i18n';
import type { PayoutOrigin, PayoutRequestStatus } from '@/types/earnings.types';

export const PAYOUT_STATUS_KEYS: Record<PayoutRequestStatus, TranslationKey> = {
  pending: 'account.earnings.status.pending',
  paid: 'account.earnings.status.paid',
  rejected: 'account.earnings.status.rejected',
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
export const PAYOUT_ORIGIN_KEYS: Record<PayoutOrigin, TranslationKey> = {
  manual: 'account.earnings.origin.manual',
  auto_threshold: 'account.earnings.origin.auto_threshold',
};

export const PAYOUT_STATUS_BADGE_CLASSES: Record<PayoutRequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

/**
 * Localized message for an earnings failure. Goes through the shared resolver,
 * so codes without an `errors.contexts.earnings` entry still get a sentence.
 */
export function earningsErrorMessage(err: unknown, fallbackKey?: TranslationKey): string {
  return apiErrorMessage(err, { context: 'earnings', fallbackKey });
}
