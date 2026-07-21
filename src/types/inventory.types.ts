// Vendor inventory — see api-doc/vendor/inventory.md (bare shapes) and
// api-doc/README.md (which states history/reservations now use the standard
// `{ success, data, meta }` envelope). The item shapes below are identical under
// either wrapper; the service normalizes the wrapper. Physical products only.

/** A variant at/below its configured low-stock threshold (`GET /inventory/alerts`). */
export interface StockAlert {
  variantId: string;
  productId: string;
  productTitle: string;
  sku: string;
  /** Raw stock count on the variant. */
  currentStock: number;
  /** Units locked by in-flight orders. */
  activeReservations: number;
  /** currentStock − activeReservations (what customers can actually buy). */
  availableStock: number;
  /** The configured `lowStockThreshold`. */
  threshold: number;
  /** availableStock / threshold * 100; `null` if not calculable. */
  stockPercentage: number | null;
}

export type StockOperation =
  | 'order'
  | 'reservation'
  | 'release'
  | 'bulk'
  | 'manual'
  | 'adjustment';

/** An immutable stock-change audit entry (`GET /inventory/history`). */
export interface StockHistoryLog {
  id: string;
  variantId: string;
  sku: string;
  previousQuantity: number;
  newQuantity: number;
  /** newQuantity − previousQuantity (negative = decreased). */
  delta: number;
  operation: StockOperation;
  timestamp: string;
  metadata?: {
    orderId?: string;
    reservationId?: string;
    batchId?: string;
    reason?: string;
  };
}

export type ReservationStatus = 'active' | 'released' | 'committed' | 'expired';

/** A stock reservation locked by an in-flight order (`GET /inventory/reservations`). */
export interface StockReservation {
  reservationId: string;
  variantId: string;
  sku: string;
  productTitle: string;
  quantity: number;
  type: 'physical' | 'digital' | 'service';
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
}

/** Normalized pagination (`meta.pages` and bare `pagination.totalPages` both map here). */
export interface InventoryPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Bulk stock update (`PATCH /inventory/bulk-update`) ────────────────────────

export interface BulkStockUpdateRow {
  variantId: string;
  /** Absolute stock level to set (not a delta). Negative only if allowOversell. */
  quantity: number;
}

export interface BulkStockUpdateVariantResult {
  variantId: string;
  sku: string;
  previousStock: number;
  newStock: number;
}

export interface BulkStockUpdateResult {
  batchId: string;
  updated: number;
  variants: BulkStockUpdateVariantResult[];
}

/**
 * Per-row failure (all-or-nothing: on any failure, nothing is updated). Carried
 * on the thrown `ApiError.rowErrors`; aliases the shared `ApiRowError`.
 */
export type { ApiRowError as BulkStockRowError } from './api';

// ─── Query params ──────────────────────────────────────────────────────────────

export interface InventoryListParams {
  page?: number;
  limit?: number;
}

export interface HistoryParams extends InventoryListParams {
  variantId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReservationParams extends InventoryListParams {
  variantId?: string;
  status?: 'active' | 'expired';
}
