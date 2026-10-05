// ─── Vendor Transactions — display helpers ───────────────────────────────────────
//
// Labels are exported as `TranslationKey`s and resolved at the call site: this
// module has no React context of its own. See src/i18n/README.md.

import type { TranslationKey } from '@/i18n';
import type {
  Transaction,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from '@/types/transactions.types';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Category sub-tabs shown above the feed. `payout` returns the vendor's payout requests. */
export const TRANSACTION_CATEGORY_TABS: {
  value: TransactionCategory | 'all';
  labelKey: TranslationKey;
}[] = [
  { value: 'all', labelKey: 'transactions.tabs.all' },
  { value: 'plan', labelKey: 'transactions.tabs.plan' },
  { value: 'credit', labelKey: 'transactions.tabs.credit' },
  { value: 'earning', labelKey: 'transactions.tabs.earning' },
  { value: 'payout', labelKey: 'transactions.tabs.payout' },
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
  reserve_hold:       { labelKey: 'transactions.status.reserve_hold',       class: 'border-border text-muted-foreground' },
  reserve_release:    { labelKey: 'transactions.status.reserve_release',    class: 'border-border text-muted-foreground' },
  clawback:           { labelKey: 'transactions.status.clawback',           class: 'border-red-500 text-red-600 bg-red-50' },
  clawback_recovery:  { labelKey: 'transactions.status.clawback_recovery',  class: 'border-border text-muted-foreground' },
  clawback_write_off: { labelKey: 'transactions.status.clawback_write_off', class: 'border-border text-muted-foreground' },
};

/**
 * The 2026-10-05 refund-debt rows. The server describes them in fixed English,
 * so they get the vendor's language here; every other row keeps the server's
 * `description`, and an unknown type still falls back to it.
 */
const TYPE_LABEL_KEYS: Partial<Record<TransactionType, TranslationKey>> = {
  earning_clawback: 'transactions.typeLabel.earning_clawback',
  earning_clawback_recovery: 'transactions.typeLabel.earning_clawback_recovery',
  earning_clawback_write_off: 'transactions.typeLabel.earning_clawback_write_off',
};

/** The row's title. */
export function transactionLabel(tx: Transaction, t: Translate): string {
  const key = TYPE_LABEL_KEYS[tx.type];
  return key ? t(key) : tx.description;
}

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

/**
 * True for money moved between the vendor's own balances. These rows are shown
 * unsigned and muted, and must be left out of any sum.
 */
export function isInternalTransaction(tx: Transaction): boolean {
  return tx.direction === 'internal';
}

/** Signed amount text + colour, keyed off `unit` and `direction`. */
export function transactionAmount(
  tx: Transaction,
  t: Translate,
  formatNumber: (value: number) => string,
  formatCurrency: (value: number, currency?: string) => string,
): { text: string; className: string } {
  const sign = isInternalTransaction(tx) ? '' : tx.direction === 'out' ? '−' : '+';
  const text =
    tx.unit === 'money'
      ? t('transactions.amount.money', {
          sign,
          amount: formatCurrency(tx.amount, tx.currency ?? 'XAF'),
        })
      : t('transactions.amount.credits', { sign, amount: formatNumber(tx.amount) });
  // Money leaving / credit spend reads neutral; value coming in reads green;
  // a move between the vendor's own balances reads muted.
  const className =
    tx.direction === 'in'
      ? 'text-green-600'
      : isInternalTransaction(tx)
        ? 'text-muted-foreground'
        : 'text-foreground';
  return { text, className };
}
