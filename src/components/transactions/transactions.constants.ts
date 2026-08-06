// ─── Vendor Transactions — display helpers ───────────────────────────────────────
//
// Labels are exported as `TranslationKey`s and resolved at the call site: this
// module has no React context of its own. See src/i18n/README.md.

import type { TranslationKey } from '@/i18n';
import type {
  Transaction,
  TransactionCategory,
  TransactionStatus,
} from '@/types/transactions.types';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Category sub-tabs shown above the feed. `payout` is omitted (placeholder/empty). */
export const TRANSACTION_CATEGORY_TABS: {
  value: TransactionCategory | 'all';
  labelKey: TranslationKey;
}[] = [
  { value: 'all', labelKey: 'transactions.tabs.all' },
  { value: 'plan', labelKey: 'transactions.tabs.plan' },
  { value: 'credit', labelKey: 'transactions.tabs.credit' },
  { value: 'earning', labelKey: 'transactions.tabs.earning' },
];

const CATEGORY_KEYS: Record<TransactionCategory, TranslationKey> = {
  plan: 'transactions.category.plan',
  credit: 'transactions.category.credit',
  earning: 'transactions.category.earning',
  payout: 'transactions.category.payout',
};

export function categoryLabel(category: TransactionCategory, t: Translate): string {
  const key = CATEGORY_KEYS[category];
  return key ? t(key) : category;
}

const STATUS_META: Record<TransactionStatus, { labelKey: TranslationKey; class: string }> = {
  pending:   { labelKey: 'transactions.status.pending',   class: 'border-amber-500 text-amber-600 bg-amber-50' },
  paid:      { labelKey: 'transactions.status.paid',      class: 'border-green-500 text-green-600 bg-green-50' },
  failed:    { labelKey: 'transactions.status.failed',    class: 'border-red-500 text-red-600 bg-red-50' },
  reversed:  { labelKey: 'transactions.status.reversed',  class: 'border-orange-500 text-orange-600 bg-orange-50' },
  completed: { labelKey: 'transactions.status.completed', class: 'border-slate-300 text-slate-600 bg-slate-50' },
  hold:      { labelKey: 'transactions.status.hold',      class: 'border-amber-500 text-amber-600 bg-amber-50' },
  release:   { labelKey: 'transactions.status.release',   class: 'border-green-500 text-green-600 bg-green-50' },
  reversal:  { labelKey: 'transactions.status.reversal',  class: 'border-orange-500 text-orange-600 bg-orange-50' },
};

export function transactionStatusMeta(
  status: TransactionStatus,
  t: Translate,
): { label: string; class: string } {
  const meta = STATUS_META[status];
  return meta
    ? { label: t(meta.labelKey), class: meta.class }
    : { label: status, class: 'border-border text-muted-foreground' };
}

/** True for chargeback/refund unwinds — surfaced with an explanatory note. */
export function isReversalTransaction(t: Transaction): boolean {
  return t.status === 'reversed' || t.status === 'reversal' || t.type === 'earning_reversal';
}

/** Signed amount text + colour, keyed off `unit` and `direction`. */
export function transactionAmount(
  tx: Transaction,
  t: Translate,
  formatNumber: (value: number) => string,
  formatCurrency: (value: number, currency?: string) => string,
): { text: string; className: string } {
  const sign = tx.direction === 'out' ? '−' : '+';
  const text =
    tx.unit === 'money'
      ? t('transactions.amount.money', {
          sign,
          amount: formatCurrency(tx.amount, tx.currency ?? 'XAF'),
        })
      : t('transactions.amount.credits', { sign, amount: formatNumber(tx.amount) });
  // Money leaving / credit spend reads neutral; value coming in reads green.
  const className = tx.direction === 'in' ? 'text-green-600' : 'text-foreground';
  return { text, className };
}
