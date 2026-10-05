// ─── Vendor Customer Management — types ───────────────────────────────────────
// Shapes derived strictly from api-doc/vendor/customer-management.md.
// Covers: customer flags, customers (list/detail + name override + flag assign),
// and refunds (eligibility + action). A customer's orders reuse the existing
// orders endpoint with a `customerId` filter (see orders.service.ts).

// ─── Flags ────────────────────────────────────────────────────────────────────

/** Vendor-defined, color-coded tag used to segment customers. */
export interface CustomerFlag {
  id: string;
  name: string;
  color: string; // hex, #RGB or #RRGGBB
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFlagPayload {
  name: string;
  color: string;
  description?: string | null;
}

export interface UpdateFlagPayload {
  name?: string;
  color?: string;
  description?: string | null;
}

// ─── Customers ──────────────────────────────────────────────────────────────────

/** A customer's default shipping address (detail only). */
export interface CustomerShippingAddress {
  street: string;
  city: string;
  state: string | null;
  country: string;
}

/** Row returned by GET /vendor/customers. */
export interface CustomerListItem {
  customerId: string;
  /** Override if set, else realName. */
  displayName: string;
  realName: string;
  hasNameOverride: boolean;
  email: string | null;
  avatar: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  flags: CustomerFlag[];
}

/** Full customer returned by GET /vendor/customers/:id (list item + contact + address). */
export interface CustomerDetail extends CustomerListItem {
  phone: string | null;
  shippingAddress: CustomerShippingAddress | null;
}

/** Body for PATCH /vendor/customers/:id/name — send null/"" to clear the override. */
export interface UpdateCustomerNamePayload {
  displayName: string | null;
}

/** Body for PUT /vendor/customers/:id/flags — full desired set (idempotent). */
export interface UpdateCustomerFlagsPayload {
  flagIds: string[];
}

// ─── Query params ─────────────────────────────────────────────────────────────

export type CustomerSortBy = 'lastOrderAt' | 'totalSpent' | 'orderCount';
export type SortOrder = 'asc' | 'desc';

export interface CustomersQueryParams {
  search?: string;
  flagId?: string;
  page?: number;
  limit?: number;
  sortBy?: CustomerSortBy;
  sortOrder?: SortOrder;
}

// ─── Refunds ──────────────────────────────────────────────────────────────────

/** reasonCode values returned when eligibility check resolves `eligible: false`. */
export type RefundReasonCode =
  | 'REFUND_POLICY_DISABLED'
  | 'REFUND_ORDER_NOT_PAID'
  | 'REFUND_PAYMENT_NOT_FOUND'
  | 'REFUND_ALREADY_FULLY_REFUNDED'
  | 'REFUND_WINDOW_EXPIRED'
  | 'REFUND_NOT_ELIGIBLE'
  /** A refund of this order is in progress — `openRefundRequest` says which (2026-10-05). */
  | 'REFUND_ALREADY_OPEN';

/** Who pays return shipping, echoed from the vendor's return policy (display-only). */
export type ReturnShippingPayer = 'vendor' | 'customer' | 'customer_reimbursed_if_defect';

/** How the customer paid, which decides how the money goes back. */
export type RefundPaymentChannel = 'card' | 'mobile_money' | 'cod';

/**
 * The lifecycle of a refund request (api-doc/payments/README.md § The refund request).
 *
 * ⛔ **Only `completed` means the customer has the money.** Every other status is
 * a refund still on its way — never word one of them as "refunded".
 *
 * Open (a second refund is refused with `REFUND_ALREADY_OPEN`): `awaiting_approval`,
 * `approved`, `waiting_for_cash`, `sending`, `failed`. Closed: `completed`, `rejected`.
 */
export type RefundRequestStatus =
  | 'awaiting_approval'
  | 'approved'
  | 'waiting_for_cash'
  | 'sending'
  | 'failed'
  | 'completed'
  | 'rejected';

export interface RefundEligibility {
  eligible: boolean;
  /** Most you may refund right now (policy + balance + delivery rule). A whole number. */
  maxRefundable: number;
  /** Un-refunded money on the order (online payments, or COD cash collected). */
  remaining: number;
  currency: string | null;
  /** Policy: expected settle window. Null when no return policy is set. */
  refundProcessingDays?: number | null;
  /** Policy: who pays return shipping. Null when no return policy is set. */
  returnShippingPayer?: ReturnShippingPayer | null;
  /** New 2026-10-05. Null when nothing refundable was paid. Optional until the backend ships it. */
  paymentChannel?: RefundPaymentChannel | null;
  /** New 2026-10-05. `true` → sent at once; `false` → Wi-Mall approves it first. */
  autoSend?: boolean;
  /** New 2026-10-05. The refund already in progress, if any. */
  openRefundRequest?: { id: string; status: RefundRequestStatus } | null;
  /** Present only when `eligible === false`. */
  reasonCode?: RefundReasonCode;
}

export interface RefundOrderPayload {
  /**
   * A whole number. Defaults server-side to `maxRefundable` — worked out with
   * `itemDefective` taken into account, so leave it out to refund the most allowed.
   */
  amount?: number;
  reason?: string;
  /** Only read under `customer_reimbursed_if_defect`: the delivery money comes back too. */
  itemDefective?: boolean;
}

/**
 * ⛔ **Breaking 2026-10-05: this is a refund REQUEST, not a finished refund.**
 * Render by `status` and show the API's own `grossAmount` / `feeAmount` /
 * `netAmount` — never work a fee out in the dashboard.
 */
export interface RefundResult {
  refundRequestId: string;
  /** @deprecated Alias of `refundRequestId`. */
  refundId: string;
  status: RefundRequestStatus;
  /** Gross — what the order loses. Same as `grossAmount`. */
  amount: number;
  grossAmount: number;
  /** The transfer fee taken off a mobile-money / COD refund. 0 for a card. */
  feeAmount: number;
  /** What the customer receives. */
  netAmount: number;
  currency: string;
  paymentChannel: RefundPaymentChannel | null;
  /** How it leaves: `card_refund` | `payout` | `external`, or null when not decided yet. */
  channel: string | null;
  /** The number the transfer goes to, already masked by the server. Null for a card. */
  destinationMasked: string | null;
  /** Why it hasn't been sent yet (`payout_unavailable`, `insufficient_gateway_balance`, …). */
  transferFailureReason: string | null;
  /** Σ COMPLETED refunds on the order. */
  totalRefunded: number;
  /** True only once the request has completed and the order is square. */
  fullyRefunded: boolean;
  /** Policy: expected settle window. Null when no return policy is set. */
  refundProcessingDays?: number | null;
  /** Policy: who pays return shipping. Null when no return policy is set. */
  returnShippingPayer?: ReturnShippingPayer | null;
}

// ─── Response envelopes ─────────────────────────────────────────────────────────

export interface CustomerListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface FlagsListResponse {
  success: boolean;
  data: CustomerFlag[];
}

export interface FlagMutationResponse {
  success: boolean;
  data: CustomerFlag;
  message?: string;
}

export interface CustomersListResponse {
  success: boolean;
  data: CustomerListItem[];
  meta: CustomerListMeta;
}

export interface CustomerDetailResponse {
  success: boolean;
  data: CustomerDetail;
  message?: string;
}

export interface RefundEligibilityResponse {
  success: boolean;
  data: RefundEligibility;
}

export interface RefundResponse {
  success: boolean;
  /** The fields new on 2026-10-05 are missing from a server that predates the refund flow. */
  data: Partial<RefundResult> &
    Pick<RefundResult, 'refundId' | 'status' | 'amount' | 'currency' | 'totalRefunded' | 'fullyRefunded'>;
  message?: string;
}
