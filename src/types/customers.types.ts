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
  | 'REFUND_NOT_ELIGIBLE';

export interface RefundEligibility {
  eligible: boolean;
  /** Most you may refund right now (policy + balance). */
  maxRefundable: number;
  /** Un-refunded balance of the payment. */
  remaining: number;
  currency: string | null;
  /** Present only when `eligible === false`. */
  reasonCode?: RefundReasonCode;
}

export interface RefundOrderPayload {
  /** Defaults server-side to maxRefundable; if provided must be ≤ maxRefundable. */
  amount?: number;
  reason?: string;
}

export interface RefundResult {
  refundId: string;
  status: string;
  amount: number;
  currency: string;
  /** Cumulative across all refunds on this payment. */
  totalRefunded: number;
  /** When true, order.payment_status becomes "refunded". */
  fullyRefunded: boolean;
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
  data: RefundResult;
  message?: string;
}
