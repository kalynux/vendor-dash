// Delivery terms — api-doc/vendor/profile.md § Delivery terms (2026-10-03, ADR-A11).
// Who pays delivery on this shop's part of a basket. Replaced the per-product
// `freeDelivery` flag, which no longer exists.
//
// Amounts are XAF "minor units" — whole francs, never divided by 100.

/**
 * `always` — the shop pays delivery (free for the customer; the default).
 * `never`  — the customer pays it.
 * `above`  — free once the customer's items from this shop reach `freeAboveAmount`
 *            (inclusive), customer-paid below it.
 */
export type DeliveryTermsMode = 'always' | 'never' | 'above';

/** `GET/PUT /api/vendor/profile/delivery-terms`. */
export interface DeliveryTerms {
  mode: DeliveryTermsMode;
  /** Required with `above`, `null` with the other two modes (the PUT refuses anything else). */
  freeAboveAmount: number | null;
  /** `null` until the terms are first saved. */
  updatedAt: string | null;
}

/** Inclusive bounds of `freeAboveAmount` (PUT validator). */
export const FREE_ABOVE_AMOUNT_MIN = 1;
export const FREE_ABOVE_AMOUNT_MAX = 100_000_000;
