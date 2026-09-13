// ─── Vendor Customer Management — display constants & helpers ──────────────────
//
// Labels are exported as `TranslationKey`s and resolved at the call site: this
// module has no React context of its own. See src/i18n/README.md.

import type { TranslationKey } from '@/i18n';
import type { RefundReasonCode, CustomerSortBy, SortOrder } from '@/types/customers.types';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

// ─── Field limits (kept in sync with customer.schemas.ts and the API docs) ──────

export const FLAG_NAME_MAX = 60;
export const FLAG_DESCRIPTION_MAX = 200;
export const DISPLAY_NAME_MAX = 120;
export const REFUND_REASON_MAX = 500;
export const MAX_FLAGS_PER_CUSTOMER = 50;

// ─── Flag colour presets ────────────────────────────────────────────────────────
// Offered as quick picks in the flag editor; vendors can also enter any hex.

export const FLAG_COLOR_PRESETS: { nameKey: TranslationKey; value: string }[] = [
  { nameKey: 'customers.colors.orange', value: '#FF8800' },
  { nameKey: 'customers.colors.red', value: '#EF4444' },
  { nameKey: 'customers.colors.amber', value: '#F59E0B' },
  { nameKey: 'customers.colors.green', value: '#22C55E' },
  { nameKey: 'customers.colors.teal', value: '#14B8A6' },
  { nameKey: 'customers.colors.blue', value: '#3B82F6' },
  { nameKey: 'customers.colors.indigo', value: '#6366F1' },
  { nameKey: 'customers.colors.violet', value: '#8B5CF6' },
  { nameKey: 'customers.colors.pink', value: '#EC4899' },
  { nameKey: 'customers.colors.slate', value: '#64748B' },
];

export const DEFAULT_FLAG_COLOR = FLAG_COLOR_PRESETS[0].value;

// ─── Sorting ─────────────────────────────────────────────────────────────────────

export interface CustomerSortOption {
  value: string;
  labelKey: TranslationKey;
  sortBy: CustomerSortBy;
  sortOrder: SortOrder;
}

export const CUSTOMER_SORT_OPTIONS: CustomerSortOption[] = [
  { value: 'recent', labelKey: 'customers.sort.recent', sortBy: 'lastOrderAt', sortOrder: 'desc' },
  { value: 'spent_desc', labelKey: 'customers.sort.spentDesc', sortBy: 'totalSpent', sortOrder: 'desc' },
  { value: 'spent_asc', labelKey: 'customers.sort.spentAsc', sortBy: 'totalSpent', sortOrder: 'asc' },
  { value: 'orders_desc', labelKey: 'customers.sort.ordersDesc', sortBy: 'orderCount', sortOrder: 'desc' },
];

// ─── Refund reason messaging ──────────────────────────────────────────────────────

/** Why an order isn't refundable, keyed by the backend's `reasonCode`. */
export const REFUND_REASON_KEYS: Record<RefundReasonCode, TranslationKey> = {
  REFUND_POLICY_DISABLED: 'customers.refundReason.REFUND_POLICY_DISABLED',
  REFUND_ORDER_NOT_PAID: 'customers.refundReason.REFUND_ORDER_NOT_PAID',
  REFUND_PAYMENT_NOT_FOUND: 'customers.refundReason.REFUND_PAYMENT_NOT_FOUND',
  REFUND_ALREADY_FULLY_REFUNDED: 'customers.refundReason.REFUND_ALREADY_FULLY_REFUNDED',
  REFUND_WINDOW_EXPIRED: 'customers.refundReason.REFUND_WINDOW_EXPIRED',
  REFUND_NOT_ELIGIBLE: 'customers.refundReason.REFUND_NOT_ELIGIBLE',
};

// ─── Display helpers ──────────────────────────────────────────────────────────────

/** Up to two initials from a display name. */
export function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Compact time since the last order — "5m ago", "3d ago", or a date past 30 days.
 * Takes the translator + date formatter so this module needs no React context.
 */
export function relativeTime(
  iso: string | null,
  t: Translate,
  formatDate: (iso: string) => string,
): string {
  if (!iso) return t('customers.time.noOrders');
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return t('common.labels.emptyValue');
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 45) return t('customers.time.justNow');
  const min = Math.round(sec / 60);
  if (min < 60) return t('customers.time.minutesAgo', { count: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return t('customers.time.hoursAgo', { count: hr });
  const day = Math.round(hr / 24);
  if (day < 30) return t('customers.time.daysAgo', { count: day });
  return formatDate(iso);
}

/**
 * Decide readable foreground (black/white) for a hex background, so flag text
 * stays legible on any vendor-chosen colour.
 */
export function contrastColor(hex: string): string {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return '#ffffff';
  // Perceived luminance (sRGB) → choose black on light, white on dark.
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111827' : '#ffffff';
}
