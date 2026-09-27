import { api } from './api';
import { apiErrorMessage, type TranslationKey } from '@/i18n';
import type {
  SalesBreakdown,
  SalesDataPoint,
  TopProduct,
  CustomerMetrics,
  BookingMetrics,
  EarningsAdjustments,
  CustomerRefunds,
} from '@/types';

// ─── Error Handling ──────────────────────────────────────────────────────────

/**
 * Friendly labels for known analytics error codes. Falls back to the backend
 * `err.message` for any unmapped code (see getAnalyticsErrorMessage).
 */
export const ANALYTICS_ERROR_LABELS: Record<string, string> = {
  ANALYTICS_INVALID_DATE_RANGE: 'The selected date range is invalid.',
  ANALYTICS_DATE_RANGE_EXCEEDED: "The date range can't exceed 366 days.",
  ANALYTICS_UNSUPPORTED_TIMEZONE: 'That timezone is not supported.',
  VENDOR_UNSUPPORTED_FISCAL_CALENDAR: 'Unsupported fiscal calendar.',
  VALIDATION_ERROR: 'The analytics request was invalid.',
  AUTH_ROLE_NOT_FOUND: "Your account doesn't have access to analytics.",
};

/** Resolve a localized, user-safe message for any analytics API failure. */
export function getAnalyticsErrorMessage(err: unknown): string {
  return apiErrorMessage(err, { fallbackKey: 'analytics.errors.loadFailed' });
}

// ─── API Response Types (mirror api-doc/vendor/analytics.md exactly) ───────────
//
// Every body is `{ data, meta }` with no `success` key. An empty period answers
// 200 with zeros — there is no "not ready" (503) state any more.

interface AnalyticsMeta {
  /** `YYYY-MM-DD`, both days included. */
  from: string;
  to: string;
  timezone: string;
  computedAt: string;
  /** e.g. "net = gross - bargainFee - commission - deliveryFee - codFee". */
  netFormula: string;
  fiscalCalendar: string;
}

interface DashboardResponse {
  data: {
    sales: SalesBreakdown;
    bookings: BookingMetrics;
    adjustments: EarningsAdjustments;
    netEarnings: number;
    /** Refunds paid to customers — information only, already in `adjustments.earningsReversed`. */
    refunds: CustomerRefunds;
  };
  meta: AnalyticsMeta & { currency: string };
}

interface SalesResponse {
  data: {
    totals: SalesBreakdown;
    /** Present only with `breakdown=daily`: one row for every day of the range. */
    daily?: Array<SalesBreakdown & { date: string }>;
  };
  meta: AnalyticsMeta & { breakdown: 'none' | 'daily' };
}

interface ProductsResponse {
  data: {
    topByRevenue: TopProduct[];
    topByQuantity: TopProduct[];
  };
  meta: AnalyticsMeta & { limit: number };
}

interface CustomersResponse {
  data: CustomerMetrics;
  meta: AnalyticsMeta;
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

/** GET /vendor/analytics/dashboard `data`. */
export type DashboardMetrics = DashboardResponse['data'];

export async function fetchDashboard(range: AnalyticsRange): Promise<DashboardMetrics> {
  const res = await api.get<DashboardResponse>(
    `/vendor/analytics/dashboard?${buildRangeQuery(range)}`,
  );
  return res.data;
}

/**
 * GET /vendor/analytics/sales?breakdown=daily. Every day of the range comes
 * back, a quiet day as zeros, so the chart needs no gap filling.
 */
export async function fetchSalesDaily(
  range: AnalyticsRange,
): Promise<{ totals: SalesBreakdown; daily: SalesDataPoint[] }> {
  const res = await api.get<SalesResponse>(
    `/vendor/analytics/sales?${buildRangeQuery(range, { breakdown: 'daily' })}`,
  );
  return {
    totals: res.data.totals,
    daily: (res.data.daily ?? []).map((d) => ({
      date: d.date,
      sales: d.grossSales,
      orders: d.orderCount,
    })),
  };
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
