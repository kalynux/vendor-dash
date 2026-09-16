// ─── Vendor Earnings — types ──────────────────────────────────────────────────
// Mirrors api-doc/vendor/earnings.md

export interface EarningsBalance {
  pending: number;
  available: number;
  /** Always 0 for vendors — present for shape-parity with the agency endpoint. */
  reserve: number;
  /** Earmarked for an in-flight payout request. */
  requested: number;
  currency: string;
}

/**
 * The lifecycle of a payout request.
 *
 * ⛔ **This gained `processing` and `failed` on 2026-09-15, and neither is
 * terminal.** A map that was exhaustive over the old three mis-renders both — and
 * a `Record<PayoutRequestStatus, …>` lookup, which is how this file's constants
 * were consumed, simply returns `undefined` for them: no label, no colour.
 *
 * | status       | the vendor's money is | say                              |
 * |--------------|-----------------------|----------------------------------|
 * | `pending`    | held                  | "Being reviewed"                 |
 * | `processing` | held                  | "On its way" — **never** "Paid"  |
 * | `paid`       | gone to them          | "Paid"                           |
 * | `rejected`   | back in `available`   | "Declined — <rejectionReason>"   |
 * | `failed`     | **still held**        | "Payment failed — we're on it"   |
 *
 * Mirrors `PayoutRequestStatus` in the backend's `payout-request.model.ts`.
 */
export type PayoutRequestStatus = 'pending' | 'processing' | 'paid' | 'rejected' | 'failed';

/**
 * The statuses in which the money has left `available` and has NOT arrived.
 *
 * ⛔ **`failed` belongs here.** A refused transfer returns nothing — the balance
 * stays reserved while an administrator retries or closes the request. This list
 * IS the backend's partial unique index (`PAYOUT_HELD_STATUSES`), which is what
 * refuses a second request with `409 EARNINGS_PAYOUT_ALREADY_PENDING`. The two
 * must not drift.
 */
export const PAYOUT_HELD_STATUSES: readonly PayoutRequestStatus[] = [
  'pending',
  'processing',
  'failed',
] as const;

/**
 * The only two statuses that end a request. `paid` sent the money; `rejected` put
 * it back in `available`. Everything else is still happening.
 */
export const PAYOUT_TERMINAL_STATUSES: readonly PayoutRequestStatus[] = [
  'paid',
  'rejected',
] as const;

/**
 * Is this request still open — i.e. is the vendor's money still in flight?
 *
 * ⛔ **Defined as "not terminal", never as "one of the three open values", so an
 * UNRECOGNISED status counts as open.** The safe default for a money record we do
 * not understand is "still happening": calling it finished would invite a second
 * request the backend then refuses, or claim a balance came back when it did not.
 * That is also why the parameter is `string` — the wire can carry a value this
 * build has never heard of.
 */
export function isPayoutOpen(status: string | null | undefined): boolean {
  if (!status) return false;
  return !(PAYOUT_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/**
 * Did this request put the money back into `available`?
 *
 * ⛔ **Only `rejected` does.** `failed` looks final and returns nothing.
 */
export function payoutReturnedBalance(status: string | null | undefined): boolean {
  return status === 'rejected';
}

/**
 * Who opened the request: the vendor (`manual`), or the daily platform sweep that
 * fires automatically once `available` reaches the auto-payout threshold
 * (`auto_threshold`). See api-doc/vendor/earnings.md — "Automatic payout".
 */
export type PayoutOrigin = 'manual' | 'auto_threshold';

export interface PayoutRequest {
  id: string;
  amount: number;
  currency: string;
  status: PayoutRequestStatus;
  /** `manual` (vendor-requested) or `auto_threshold` (platform swept it at the threshold). */
  origin: PayoutOrigin;
  /** The linked PAYOUT_REQUEST support ticket — open it under Tickets for the full history. */
  ticketId: string;
  /** Set when `status` is `rejected`. Absent on the create response. */
  rejectionReason?: string | null;
  createdAt: string;
  /** When an admin marked it paid/rejected. Absent on the create response, `null` while pending. */
  resolvedAt?: string | null;
}

// ─── Response envelopes ────────────────────────────────────────────────────────

export interface EarningsResponse {
  success: boolean;
  data: EarningsBalance;
}

export interface PayoutRequestResponse {
  success: boolean;
  data: PayoutRequest;
  message?: string;
}

export interface LatestPayoutResponse {
  success: boolean;
  /** `null` if no payout request was ever made. */
  data: PayoutRequest | null;
}
