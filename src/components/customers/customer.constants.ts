// ─── Vendor Customer Management — display constants & helpers ──────────────────

import type { RefundReasonCode, CustomerSortBy, SortOrder } from '@/types/customers.types';

// ─── Field limits (kept in sync with customer.schemas.ts and the API docs) ──────

export const FLAG_NAME_MAX = 60;
export const FLAG_DESCRIPTION_MAX = 200;
export const DISPLAY_NAME_MAX = 120;
export const REFUND_REASON_MAX = 500;
export const MAX_FLAGS_PER_CUSTOMER = 50;

// ─── Flag colour presets ────────────────────────────────────────────────────────
// Offered as quick picks in the flag editor; vendors can also enter any hex.

export const FLAG_COLOR_PRESETS: { name: string; value: string }[] = [
  { name: 'Orange', value: '#FF8800' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Slate', value: '#64748B' },
];

export const DEFAULT_FLAG_COLOR = FLAG_COLOR_PRESETS[0].value;

// ─── Sorting ─────────────────────────────────────────────────────────────────────

export interface CustomerSortOption {
  value: string;
  label: string;
  sortBy: CustomerSortBy;
  sortOrder: SortOrder;
}

export const CUSTOMER_SORT_OPTIONS: CustomerSortOption[] = [
  { value: 'recent', label: 'Most recent order', sortBy: 'lastOrderAt', sortOrder: 'desc' },
  { value: 'spent_desc', label: 'Highest spend', sortBy: 'totalSpent', sortOrder: 'desc' },
  { value: 'spent_asc', label: 'Lowest spend', sortBy: 'totalSpent', sortOrder: 'asc' },
  { value: 'orders_desc', label: 'Most orders', sortBy: 'orderCount', sortOrder: 'desc' },
];

// ─── Refund reason messaging ──────────────────────────────────────────────────────

/** Human-readable explanation for why an order isn't refundable. */
export const REFUND_REASON_LABELS: Record<RefundReasonCode, string> = {
  REFUND_POLICY_DISABLED: 'Your return policy has refunds disabled.',
  REFUND_ORDER_NOT_PAID: 'This order has not been paid, so there is nothing to refund.',
  REFUND_PAYMENT_NOT_FOUND: 'No successful payment is linked to this order.',
  REFUND_ALREADY_FULLY_REFUNDED: 'This order has already been fully refunded.',
  REFUND_WINDOW_EXPIRED: 'The return window for this order has expired.',
  REFUND_NOT_ELIGIBLE: 'Your policy resolves the refundable amount to zero for this order.',
};

// ─── Display helpers ──────────────────────────────────────────────────────────────

/**
 * Format a whole-currency-unit amount. Customer totals carry no currency in the
 * payload (platform currency is XAF), while order/refund amounts do — pass it.
 */
export function formatMoney(amount: number, currency = 'XAF'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain number + code.
    return `${new Intl.NumberFormat().format(amount)} ${currency}`;
  }
}

/** Up to two initials from a display name. */
export function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Absolute date, e.g. "Jun 1, 2026". */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Compact relative time, e.g. "5m ago", "3d ago", or a date. */
export function relativeTime(iso: string | null): string {
  if (!iso) return 'No orders yet';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

/**
 * Responsive props for a Sheet: a bottom sheet on mobile, a right-side panel on
 * desktop. Mirrors the tickets module convention.
 */
export function responsiveSheetProps(
  isMobile: boolean,
  desktopWidth = 'sm:max-w-xl',
): { side: 'bottom' | 'right'; className: string } {
  return isMobile
    ? { side: 'bottom', className: 'h-[92vh] rounded-t-2xl' }
    : { side: 'right', className: `w-full ${desktopWidth}` };
}
