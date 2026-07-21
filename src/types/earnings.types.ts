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

export type PayoutRequestStatus = 'pending' | 'paid' | 'rejected';

export interface PayoutRequest {
  id: string;
  amount: number;
  currency: string;
  status: PayoutRequestStatus;
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
