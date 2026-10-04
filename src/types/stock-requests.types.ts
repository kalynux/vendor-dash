// Two-signature stock changes on an agency-warehoused SKU.
// See api-doc/vendor/stock-requests.md and api-doc/agency/stock-requests.md §3.
//
// Only applies to a product whose `delivery.pickupLocation.source` is
// `agency_storage`. For those, neither party writes `variant.stock` alone: one
// side proposes, the other approves. Every other product in the catalogue is
// unchanged — its stock is still edited directly.
//
// Standalone on purpose (imports only the leaf `file.types.ts`) so
// `product.types.ts` and `inventory.types.ts` can both pull from it without a cycle.

import type { FileRef } from './file.types';

export type StockRequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export type StockRequestParty = 'vendor' | 'agency';

/**
 * A verb the CURRENT VIEWER may use on a request.
 *
 * **Render buttons from `availableActions`, never from your own status logic.**
 * The server sends its authority table's verdict on every DTO; re-deriving it
 * client-side is how a UI offers a verb the API refuses.
 */
export type StockRequestAction = 'approve' | 'reject' | 'withdraw';

/** `awaiting_me` = pending and raised by the other party — your action list. */
export type StockRequestDirection = 'awaiting_me' | 'raised_by_me';

export interface StockRequestApproval {
  byRole: StockRequestParty;
  at: string;
  /** What the SKU actually held the instant it was replaced — the drift audit trail. */
  quantityAtApply: number | null;
}

export interface StockRequestRejection {
  byRole: StockRequestParty;
  at: string;
  reason?: string | null;
}

export interface StockRequestWithdrawal {
  byRole: StockRequestParty;
  at: string;
}

export interface StockRequestStatusEvent {
  status: StockRequestStatus;
  changedAt: string;
  changedByRole: StockRequestParty;
  note?: string | null;
}

export interface StockRequestProduct {
  /** The product's CURRENT title. */
  title: string | null;
  variantTitle: string | null;
  sku: string | null;
  /** Variant's first image, else the product's. `url` is `null` unless `access` is `public`. */
  image: FileRef | null;
}

export interface StockRequestVendor {
  id: string;
  businessName: string | null;
  verified: boolean;
}

export interface StockRequestLocation {
  id: string;
  label: string | null;
  city: string | null;
  isPrimary: boolean;
}

export interface StockRequestDto {
  id: string;
  productId: string;
  variantId: string;
  vendorId: string;
  agencyId: string;

  requestedByRole: StockRequestParty;
  requestedAt: string;

  // ─── The three quantities ────────────────────────────────────────────────
  // `quantityBefore` is what the PROPOSER saw, `currentQuantity` is what the
  // SKU reads NOW, `requestedQuantity` is what it will read if approved. The
  // first two differing is DRIFT, not an error — show both.

  quantityBefore: number;
  infiniteBefore: boolean;
  /** The ABSOLUTE target, never a delta. `0` is valid. */
  requestedQuantity: number;
  requestedInfinite: boolean;
  /** `null` in the list when unresolvable. */
  currentQuantity: number | null;
  currentInfinite: boolean | null;

  status: StockRequestStatus;
  /** The proposer's own words, shown to the counterparty. Safe to render. */
  note?: string | null;

  /** Drives the badge count. */
  awaitingMyDecision: boolean;
  /** `['withdraw']` if you raised it · `['approve','reject']` if they did · `[]` once resolved. */
  availableActions: StockRequestAction[];

  /** Exactly one is non-null once resolved. */
  approval: StockRequestApproval | null;
  rejection: StockRequestRejection | null;
  withdrawal: StockRequestWithdrawal | null;

  statusHistory: StockRequestStatusEvent[];
  createdAt: string;
  updatedAt: string;

  // ─── What it is about (added 2026-10-04) ──────────────────────────────────
  // See api-doc/vendor/FRONTEND-CHANGELOG-stock-request-names.md. Resolved LIVE
  // when the request is read, not snapshotted when raised — a renamed product
  // shows its current title even on closed requests. A deleted product, variant
  // or depot reads as `null`, so every one of these needs a fallback.

  product: StockRequestProduct | null;
  /** Yourself. Not rendered. */
  vendor: StockRequestVendor | null;
  /** The agency's depot holding this SKU. `null` when it has no inventory row, or deleted the depot. */
  location: StockRequestLocation | null;
  /** The AGENCY's inventory row id. No vendor endpoint opens it — never link to it. */
  stockLevelId: string | null;
}

// ─── The shared `meta.stockAdjustment` block ────────────────────────────────
// Returned by the three intercepted stock writes (variant PATCH, simple PATCH,
// and — as sibling arrays rather than this block — inventory bulk-update).
//
// Its presence is the ONLY signal that the quantity did not land: the status is
// still 200 (not 202), and `data.stock` is the OLD value. If a UI optimistically
// renders what was typed, it is now wrong.

export type StockAdjustmentStatus = 'pending_agency_approval';

/**
 * The docs elide most of the request (`"…": "…"`), so only these three are
 * guaranteed; the rest arrives in practice but is typed optional.
 */
export type StockAdjustmentRequest = Pick<
  StockRequestDto,
  'id' | 'requestedQuantity' | 'availableActions'
> &
  Partial<Omit<StockRequestDto, 'id' | 'requestedQuantity' | 'availableActions'>>;

export interface StockAdjustmentMeta {
  /** Widened so a status the backend adds later doesn't break the type. */
  status: StockAdjustmentStatus | (string & {});
  request: StockAdjustmentRequest;
}

// ─── Params & envelopes ─────────────────────────────────────────────────────

/**
 * Unknown query parameters are rejected with `400 VALIDATION_ERROR`, so the
 * query string is built from a fixed whitelist — never spread an arbitrary
 * object into it.
 */
export interface StockRequestListParams {
  page?: number;
  limit?: number;
  /** Omit to get EVERY status, terminal rows included. That is the documented default. */
  status?: StockRequestStatus;
  productId?: string;
  variantId?: string;
  direction?: StockRequestDirection;
  /**
   * 1–100 chars, case-insensitive substring over product title and variant SKU.
   * Trimmed before sending; an empty value is never sent (it would be a 400).
   */
  search?: string;
}

export interface CreateStockRequestPayload {
  productId: string;
  variantId: string;
  /** Absolute target, integer ≥ 0. `0` is valid. */
  quantity: number;
  /** Max 500 chars. Shown to the agency — say why. */
  note?: string;
}

export interface StockRequestListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StockRequestListResponse {
  success: boolean;
  data: StockRequestDto[];
  meta: StockRequestListMeta;
}

export interface StockRequestDetailResponse {
  success: boolean;
  data: StockRequestDto;
  message?: string;
}
