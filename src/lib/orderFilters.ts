import type { OrdersQueryParams } from '@/services/orders.service';
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types';

/**
 * URL-backed Orders list filters. Every dimension is single-value, matching the
 * documented `GET /api/vendor/orders` query contract (api-doc/vendor/orders.md) —
 * one enum value per param, no arrays. The Orders page keeps these in the URL
 * query string so they're shareable and back-button friendly; `parseOrderFilters`
 * reads them back and `orderFiltersToQuery` turns them into a service request.
 */
export interface OrderFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  orderType?: 'physical' | 'digital';
  /** ISO 8601 lower bound on order date. */
  dateFrom?: string;
  /** ISO 8601 upper bound on order date. */
  dateTo?: string;
  /** Deep-link scope from the Customers tab; no on-page picker. */
  customerId?: string;
  /** Free-text search (order number, customer name/email). */
  q?: string;
}

/** URL query keys owned by the filter layer — everything else (e.g. `view`, `page`) is left untouched. */
export const ORDER_FILTER_KEYS = [
  'status',
  'paymentStatus',
  'paymentMethod',
  'orderType',
  'dateFrom',
  'dateTo',
  'customerId',
  'q',
] as const;

/** Read the filter state out of a URLSearchParams (empty/missing keys are omitted). */
export function parseOrderFilters(sp: URLSearchParams): OrderFilters {
  const f: OrderFilters = {};
  for (const key of ORDER_FILTER_KEYS) {
    const value = sp.get(key);
    if (value) (f as Record<string, string>)[key] = value;
  }
  return f;
}

/** Read the 1-indexed page from the URL, defaulting to 1 for missing/invalid values. */
export function parseOrderPage(sp: URLSearchParams): number {
  const page = Number(sp.get('page'));
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

/**
 * Count the active filter dimensions for the "Filters (N)" badge. `q` is excluded
 * (it has its own search box); a date range counts as a single dimension.
 */
export function countActiveFilters(f: OrderFilters): number {
  let n = 0;
  if (f.status) n++;
  if (f.paymentStatus) n++;
  if (f.paymentMethod) n++;
  if (f.orderType) n++;
  if (f.dateFrom || f.dateTo) n++;
  if (f.customerId) n++;
  return n;
}

/** Whether any filter (excluding search) is active. */
export function hasActiveFilters(f: OrderFilters): boolean {
  return countActiveFilters(f) > 0;
}

/** Build the service request params from filter state + pagination. */
export function orderFiltersToQuery(f: OrderFilters, page: number, limit: number): OrdersQueryParams {
  return {
    status: f.status,
    paymentStatus: f.paymentStatus,
    paymentMethod: f.paymentMethod,
    orderType: f.orderType,
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
    customerId: f.customerId,
    q: f.q || undefined,
    page,
    limit,
  };
}

/** Convert a calendar day to the ISO 8601 start-of-day instant for `dateFrom`. */
export function toDateFromIso(day: Date): string {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Convert a calendar day to the ISO 8601 end-of-day instant for `dateTo` (inclusive). */
export function toDateToIso(day: Date): string {
  const d = new Date(day);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
