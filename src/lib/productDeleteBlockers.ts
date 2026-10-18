// `CATALOG_PRODUCT_DELETE_BLOCKED` — why a permanent delete was refused.
// `details: { productId, blockers: [{ reason, count?, message }] }` lists EVERY
// reason at once. See api-doc/vendor/FRONTEND-CHANGELOG-product-permanent-delete.md.
//
// Translate by `reason`, never by `message`: the message is English-only. It is
// shown only for a reason this app has no wording for, which the changelog says
// to treat as permanent.

import type { TranslationKey } from '@/i18n';
import { ApiError } from '@/types/api';

export const DELETE_BLOCKED_CODE = 'CATALOG_PRODUCT_DELETE_BLOCKED';

export type DeleteBlockerReason =
  | 'not_archived'
  | 'has_orders'
  | 'has_bookings'
  | 'has_digital_purchases'
  | 'has_reviews'
  | 'checkout_in_progress'
  | 'negotiation_in_progress'
  | 'agency_stock_counted'
  | 'stock_request_pending';

export interface DeleteBlocker {
  /** A known reason, or `null` for one this app has no wording for. */
  reason: DeleteBlockerReason | null;
  /** On every reason except `not_archived`. */
  count?: number;
  /** The backend's English sentence — only shown when `reason` is `null`. */
  message: string;
}

const REASON_KEYS: Record<DeleteBlockerReason, TranslationKey> = {
  not_archived: 'products.permanentDelete.reasons.not_archived',
  has_orders: 'products.permanentDelete.reasons.has_orders',
  has_bookings: 'products.permanentDelete.reasons.has_bookings',
  has_digital_purchases: 'products.permanentDelete.reasons.has_digital_purchases',
  has_reviews: 'products.permanentDelete.reasons.has_reviews',
  checkout_in_progress: 'products.permanentDelete.reasons.checkout_in_progress',
  negotiation_in_progress: 'products.permanentDelete.reasons.negotiation_in_progress',
  agency_stock_counted: 'products.permanentDelete.reasons.agency_stock_counted',
  stock_request_pending: 'products.permanentDelete.reasons.stock_request_pending',
};

/** Over by themselves — a later try can work. */
const TEMPORARY: ReadonlySet<DeleteBlockerReason> = new Set([
  'checkout_in_progress',
  'negotiation_in_progress',
  'stock_request_pending',
]);

/** `null` when the error is not this refusal, or carries no usable list. */
export function readDeleteBlockers(err: unknown): DeleteBlocker[] | null {
  if (!(err instanceof ApiError) || err.code !== DELETE_BLOCKED_CODE) return null;
  const raw = err.detailsObject?.blockers;
  if (!Array.isArray(raw)) return null;
  const blockers = raw.flatMap((entry): DeleteBlocker[] => {
    if (!entry || typeof entry !== 'object') return [];
    const { reason, count, message } = entry as Record<string, unknown>;
    const known = typeof reason === 'string' && reason in REASON_KEYS;
    const text = typeof message === 'string' ? message.trim() : '';
    // Unknown and wordless: nothing true to show.
    if (!known && !text) return [];
    return [
      {
        reason: known ? (reason as DeleteBlockerReason) : null,
        ...(typeof count === 'number' ? { count } : {}),
        message: text,
      },
    ];
  });
  return blockers.length > 0 ? blockers : null;
}

export function deleteBlockerText(t: (key: TranslationKey) => string, blocker: DeleteBlocker): string {
  return blocker.reason ? t(REASON_KEYS[blocker.reason]) : blocker.message;
}

/**
 * Does any reason mean "this product can only ever stay archived"? `not_archived`
 * does not count — archiving fixes it. An unknown reason does, per the changelog.
 */
export function mustStayArchived(blockers: DeleteBlocker[]): boolean {
  return blockers.some(
    (b) => b.reason === null || (b.reason !== 'not_archived' && !TEMPORARY.has(b.reason)),
  );
}
