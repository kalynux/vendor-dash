// Partial payment — api-doc/vendor/FRONTEND-CHANGELOG-partial-payment.md (2026-11-01).
//
// A customer pays part of an order online and the delivery agent collects the
// rest in cash. Amounts are XAF "minor units", which for XAF are whole francs —
// pass them to `fmt.currency` as they are, never divided by 100.

/** `GET/PUT /api/vendor/profile/partial-payment`. */
export interface PartialPaymentTerms {
  enabled: boolean;
  /** The minimum share paid online, in percent. `null` until first set. */
  minPercent: number | null;
  /** `null` until the terms are first saved. */
  updatedAt: string | null;
}

/** Inclusive bounds of `minPercent` (PUT validator). */
export const PARTIAL_PAYMENT_MIN_PERCENT = 10;
export const PARTIAL_PAYMENT_MAX_PERCENT = 90;
/** The most a customer may pay online, whatever the vendor's minimum. */
export const PARTIAL_PAYMENT_CUSTOMER_MAX_PERCENT = 90;

/**
 * `partialPayment` on an order in the list and the detail; `null` on every other
 * order. Until the online part is paid, `paidAt` is `null`, `amountPaidOnline` is
 * 0 and `balanceDue` is the whole total.
 */
export interface OrderPartialPayment {
  amountPaidOnline: number;
  balanceDue: number;
  paidAt: string | null;
}
