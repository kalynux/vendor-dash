import type { TranslationKey } from '@/i18n';
import type {
  StockRequestDirection,
  StockRequestStatus,
} from '@/types/stock-requests.types';

/**
 * Label tables for the stock-request inbox. This module has no React context of
 * its own (it is imported from the tab, the row and the detail sheet), so it
 * exports `TranslationKey`s and lets each call site resolve them with its own
 * `t` — the house pattern for constants modules.
 */

export const STOCK_REQUEST_STATUSES: StockRequestStatus[] = [
  'pending',
  'approved',
  'rejected',
  'withdrawn',
];

export const STOCK_REQUEST_DIRECTIONS: StockRequestDirection[] = [
  'awaiting_me',
  'raised_by_me',
];

export const STATUS_LABEL_KEYS: Record<StockRequestStatus, TranslationKey> = {
  pending: 'inventory.requests.status.pending',
  approved: 'inventory.requests.status.approved',
  rejected: 'inventory.requests.status.rejected',
  withdrawn: 'inventory.requests.status.withdrawn',
};

export const DIRECTION_LABEL_KEYS: Record<StockRequestDirection, TranslationKey> = {
  awaiting_me: 'inventory.requests.direction.awaiting_me',
  raised_by_me: 'inventory.requests.direction.raised_by_me',
};

/** Pill treatment, matching the palette the tickets/connections lists already use. */
export const STATUS_BADGE_CLASSES: Record<StockRequestStatus, string> = {
  pending:
    'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  approved:
    'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800',
  rejected: 'text-destructive bg-destructive/10 border-destructive/20',
  withdrawn: 'text-muted-foreground bg-muted border-border',
};

export const STATUS_DOT_CLASSES: Record<StockRequestStatus, string> = {
  pending: 'bg-amber-500',
  approved: 'bg-emerald-500',
  rejected: 'bg-destructive',
  withdrawn: 'bg-muted-foreground',
};

/** Fallback label for a row the list did not enrich with a SKU. */
export function shortVariantId(variantId: string): string {
  return variantId.length > 8 ? `…${variantId.slice(-6)}` : variantId;
}
