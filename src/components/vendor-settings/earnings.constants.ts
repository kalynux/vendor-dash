// ─── Vendor Earnings — display constants & helpers ───────────────────────────
//
// Labels are translation *keys*, not sentences: this module is imported by both
// the desktop and mobile payout surfaces and has no React context of its own, so
// each call site resolves them with `t` and they follow a language switch.

import { apiErrorMessage, type TranslationKey } from '@/i18n';
import { isPayoutOpen, type PayoutOrigin, type PayoutRequestStatus } from '@/types/earnings.types';

/**
 * ⛔ **Read these through `payoutStatusKey` / `payoutStatusBadgeClass`, never by
 * indexing the record directly.** A `Record<PayoutRequestStatus, …>` lookup is
 * typed as total but is not: the day the backend started sending `processing` and
 * `failed` (2026-09-15) a direct index returned `undefined` for both — meaning
 * `t(undefined)` and a badge with no colour, so a live payout rendered as a blank
 * chip. The helpers below fall back to "in progress" instead.
 */
export const PAYOUT_STATUS_KEYS: Record<PayoutRequestStatus, TranslationKey> = {
  pending: 'account.earnings.status.pending',
  // ⛔ Approved is not arrived. This must never read as "Paid".
  processing: 'account.earnings.status.processing',
  paid: 'account.earnings.status.paid',
  rejected: 'account.earnings.status.rejected',
  // ⛔ Looks final, is not: the money is still held and there is nothing to re-request.
  failed: 'account.earnings.status.failed',
};

/**
 * The line under the badge saying where the money actually is — the badge alone
 * cannot carry "refused, but still held".
 */
export const PAYOUT_STATUS_NOTE_KEYS: Record<PayoutRequestStatus, TranslationKey> = {
  pending: 'account.earnings.statusNote.pending',
  processing: 'account.earnings.statusNote.processing',
  paid: 'account.earnings.statusNote.paid',
  rejected: 'account.earnings.statusNote.rejected',
  failed: 'account.earnings.statusNote.failed',
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
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  // Distinct from `rejected`: a refused transfer is not a decision, and the two
  // must not read as the same outcome.
  failed: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

// ─── Unknown statuses ─────────────────────────────────────────────────────────
//
// ⛔ **An unrecognised status renders as in-progress, never as a failure.** The
// safe reading of a money record this build does not understand is "still
// happening" — see `isPayoutOpen`.

const UNKNOWN_STATUS_KEY: TranslationKey = 'account.earnings.status.unknown';
const UNKNOWN_STATUS_NOTE_KEY: TranslationKey = 'account.earnings.statusNote.unknown';
const UNKNOWN_STATUS_BADGE = 'bg-muted text-muted-foreground';

function isKnownStatus(status: string): status is PayoutRequestStatus {
  return Object.prototype.hasOwnProperty.call(PAYOUT_STATUS_KEYS, status);
}

/** The badge label's key. Takes `string`: the wire can carry a status we lack. */
export function payoutStatusKey(status: string): TranslationKey {
  return isKnownStatus(status) ? PAYOUT_STATUS_KEYS[status] : UNKNOWN_STATUS_KEY;
}

/** The "where the money is" line's key. */
export function payoutStatusNoteKey(status: string): TranslationKey {
  return isKnownStatus(status) ? PAYOUT_STATUS_NOTE_KEYS[status] : UNKNOWN_STATUS_NOTE_KEY;
}

/** The badge's colour. Never empty — an unstyled chip reads as a broken screen. */
export function payoutStatusBadgeClass(status: string): string {
  return isKnownStatus(status) ? PAYOUT_STATUS_BADGE_CLASSES[status] : UNKNOWN_STATUS_BADGE;
}

/**
 * The sentence beside the disabled "Request withdrawal" button.
 *
 * `failed` gets its own: telling a vendor to wait for a decision when the transfer
 * was refused invites them to press again, and the backend refuses that with
 * `409 EARNINGS_PAYOUT_ALREADY_PENDING` because the money never came back.
 */
export function payoutOpenRequestKey(status: string): TranslationKey {
  return isPayoutOpen(status) && status === 'failed'
    ? 'account.earnings.openRequest.failed'
    : 'account.earnings.openRequest.generic';
}

/**
 * Localized message for an earnings failure. Goes through the shared resolver,
 * so codes without an `errors.contexts.earnings` entry still get a sentence.
 */
export function earningsErrorMessage(err: unknown, fallbackKey?: TranslationKey): string {
  return apiErrorMessage(err, { context: 'earnings', fallbackKey });
}
