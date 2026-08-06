import { api } from './api';
import { ApiError } from '@/types/api';
import { apiErrorMessage, type TranslationKey } from '@/i18n';
import type {
  SalesDataPoint,
  TopProduct,
  CustomerMetrics,
  BookingMetrics,
} from '@/types';

// ─── Error Handling ──────────────────────────────────────────────────────────

/**
 * Friendly labels for known analytics error codes. Falls back to the backend
 * `err.message` for any unmapped code (see getAnalyticsErrorMessage).
 */
export const ANALYTICS_ERROR_LABELS: Record<string, string> = {
  ANALYTICS_AGGREGATION_NOT_READY: "Analytics for this period aren't ready yet. Please check back shortly.",
  ANALYTICS_INVALID_DATE_RANGE: 'The selected date range is invalid.',
  ANALYTICS_DATE_RANGE_EXCEEDED: "The date range can't exceed 365 days.",
  ANALYTICS_UNSUPPORTED_TIMEZONE: 'That timezone is not supported.',
  VENDOR_UNSUPPORTED_FISCAL_CALENDAR: 'Unsupported fiscal calendar.',
  VALIDATION_ERROR: 'The analytics request was invalid.',
  AUTH_ROLE_NOT_FOUND: "Your account doesn't have access to analytics.",
};

/**
 * True when the backend has no aggregated data for the requested range yet.
 * Keys off the ANALYTICS_AGGREGATION_NOT_READY code, with an HTTP 503 fallback.
 */
export function isAggregationNotReady(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'ANALYTICS_AGGREGATION_NOT_READY' || err.status === 503);
}

/** Resolve a localized, user-safe message for any analytics API failure. */
export function getAnalyticsErrorMessage(err: unknown): string {
  return apiErrorMessage(err, { fallbackKey: 'analytics.errors.loadFailed' });
}

// ─── API Response Types (mirror api-doc/vendor/analytics.md exactly) ───────────

interface ApiSalesTotals {
  gmv: number;
  refunds: number;
  netRevenue: number;
  orderCount: number;
  aov: number;
}

interface DashboardResponse {
  data: {
    sales: ApiSalesTotals;
    bookings: { count: number; revenue: number };
  };
  meta: {
    from: string;
    to: string;
    lastCalculatedAt: string;
    fiscalCalendar: string;
    timezone: string;
  };
}

interface SalesDailyResponse {
  data: {
    daily: Array<ApiSalesTotals & { date: string }>;
  };
  meta: Record<string, unknown>;
}

interface ApiTopProduct {
  variantId: string;
  sku: string;
  productTitle: string;
  variantTitle: string;
  revenue: number;
  quantity: number;
}

interface ProductsResponse {
  data: {
    topByRevenue: ApiTopProduct[];
    topByQuantity: ApiTopProduct[];
  };
  meta: Record<string, unknown>;
}

interface CustomersResponse {
  data: {
    total: number;
    repeat: number;
    repeatRate: number;
  };
  meta: Record<string, unknown>;
}

// ─── Query params ──────────────────────────────────────────────────────────────

/** ISO date-string range (YYYY-MM-DD) sent to every analytics endpoint. */
export interface AnalyticsRange {
  from: string;
  to: string;
  /** IANA timezone; omit to use the vendor's default timezone. */
  timezone?: string;
}

function buildRangeQuery(range: AnalyticsRange, extra?: Record<string, string>): string {
  const q = new URLSearchParams();
  q.set('from', range.from);
  q.set('to', range.to);
  if (range.timezone) q.set('timezone', range.timezone);
  if (extra) for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return q.toString();
}

// ─── Date-range helpers ──────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Format a Date as a `YYYY-MM-DD` string in local time. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The preset ranges offered by the date-range dropdown, in display order.
 *
 * The English strings are **identifiers**, not display copy — `presetRange`
 * switches on them and `DateRange.label` round-trips them through the store.
 * Render them through `DATE_RANGE_PRESET_KEYS` instead of printing them.
 */
export const DATE_RANGE_PRESETS = [
  'Today',
  'Yesterday',
  'Last 7 days',
  'Last week',
  'Last month',
] as const;

/** Display key per preset id, plus the user-picked "Custom" range. */
export const DATE_RANGE_PRESET_KEYS: Record<string, TranslationKey> = {
  Today: 'common.time.today',
  Yesterday: 'common.time.yesterday',
  'Last 7 days': 'common.time.last7Days',
  'Last week': 'common.time.lastWeek',
  'Last month': 'common.time.lastMonth',
  Custom: 'common.time.custom',
};

/**
 * Resolve a named date-range preset to a concrete {from, to} range.
 * Returns null for unknown labels (e.g. "Custom", which is user-picked).
 * "Last week"/"Last month" mean the previous *calendar* week (Mon–Sun) / month.
 */
export function presetRange(label: string): { from: Date; to: Date; label: string } | null {
  const today = startOfDay(new Date());
  switch (label) {
    case 'Today':
      return { from: today, to: today, label };
    case 'Yesterday': {
      const y = new Date(today.getTime() - DAY_MS);
      return { from: y, to: y, label };
    }
    case 'Last 7 days':
      return { from: new Date(today.getTime() - 6 * DAY_MS), to: today, label };
    case 'Last week': {
      // Previous calendar week, Monday–Sunday.
      const sinceMonday = (today.getDay() + 6) % 7;
      const thisMonday = new Date(today.getTime() - sinceMonday * DAY_MS);
      return {
        from: new Date(thisMonday.getTime() - 7 * DAY_MS),
        to: new Date(thisMonday.getTime() - DAY_MS),
        label,
      };
    }
    case 'Last month':
      return {
        from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        to: new Date(today.getFullYear(), today.getMonth(), 0),
        label,
      };
    default:
      return null;
  }
}

/** The immediately preceding equal-length range, used for period-over-period deltas. */
export function previousRange(from: Date, to: Date): { from: Date; to: Date } {
  const lengthMs = startOfDay(to).getTime() - startOfDay(from).getTime();
  const prevTo = new Date(startOfDay(from).getTime() - DAY_MS);
  const prevFrom = new Date(prevTo.getTime() - lengthMs);
  return { from: prevFrom, to: prevTo };
}

// ─── Service Functions ─────────────────────────────────────────────────────────

export interface DashboardMetrics {
  sales: ApiSalesTotals;
  bookings: BookingMetrics;
}

export async function fetchDashboard(range: AnalyticsRange): Promise<DashboardMetrics> {
  const res = await api.get<DashboardResponse>(
    `/vendor/analytics/dashboard?${buildRangeQuery(range)}`,
  );
  return res.data;
}

export async function fetchSalesDaily(range: AnalyticsRange): Promise<SalesDataPoint[]> {
  const res = await api.get<SalesDailyResponse>(
    `/vendor/analytics/sales?${buildRangeQuery(range, { breakdown: 'daily' })}`,
  );
  return res.data.daily.map((d) => ({ date: d.date, sales: d.gmv, orders: d.orderCount }));
}

export async function fetchTopProducts(
  range: AnalyticsRange,
  limit = 5,
): Promise<{ topByRevenue: TopProduct[]; topByQuantity: TopProduct[] }> {
  const res = await api.get<ProductsResponse>(
    `/vendor/analytics/products?${buildRangeQuery(range, { limit: String(limit) })}`,
  );
  return res.data;
}

export async function fetchCustomerMetrics(range: AnalyticsRange): Promise<CustomerMetrics> {
  const res = await api.get<CustomersResponse>(
    `/vendor/analytics/customers?${buildRangeQuery(range)}`,
  );
  return res.data;
}
