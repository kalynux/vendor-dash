import type { Formatters, TranslateParams, TranslationKey } from '@/i18n';
import type { EarningsAdjustment } from '@/types/earnings.types';

type Translate = (key: TranslationKey, params?: TranslateParams) => string;

/**
 * "Why was money taken back?" in the vendor's own language
 * (FRONTEND-CHANGELOG-refund-fees, 2026-10-22).
 *
 * The server sends an English `explanation`, plus `reasonCode` + `reasonParams`
 * so a screen can word it itself. We word every code and kind we know, and fall
 * back to the server's sentence only for one this build has never heard of — the
 * same rule as `agencyBlockerText`. The parameter names are those of the
 * backend's `domain/adjustment-explanations.ts`.
 */

function str(p: Record<string, unknown>, key: string): string | null {
  const v = p[key];
  return typeof v === 'string' && v.trim() ? v : null;
}

function num(p: Record<string, unknown>, key: string): number {
  const v = p[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function orderPhrase(t: Translate, orderNumber: string | null): string {
  return orderNumber ? t('account.earnings.adjustments.order', { number: orderNumber }) : t('account.earnings.adjustments.thisOrder');
}

export function parcelPhrase(t: Translate, trackingNumber: string | null): string {
  return trackingNumber ? t('account.earnings.adjustments.parcel', { number: trackingNumber }) : t('account.earnings.adjustments.thisParcel');
}

export function adjustmentSentence(row: EarningsAdjustment, t: Translate, fmt: Formatters): string {
  const p = row.reasonParams ?? {};
  const money = (n: number) => fmt.currency(n, row.currency);
  const order = orderPhrase(t, str(p, 'orderNumber'));
  const parcel = parcelPhrase(t, str(p, 'trackingNumber'));
  const amount = money(num(p, 'amount') || row.amount);

  switch (row.reasonCode) {
    case 'refund_share':
      return t('account.earnings.adjustments.reason.refundShare', { order, amount });
    case 'dispute_share':
      return t('account.earnings.adjustments.reason.disputeShare', { order, amount });
    // Both come from the server's `explainVendorBeyond`, with the same parameters.
    case 'refund_beyond_share':
    case 'dispute_payin_fee': {
      const parts: string[] = [];
      if (num(p, 'goods') > 0) parts.push(t('account.earnings.adjustments.reason.beyond.goods', { amount: money(num(p, 'goods')) }));
      if (num(p, 'delivery') > 0) parts.push(t('account.earnings.adjustments.reason.beyond.delivery', { amount: money(num(p, 'delivery')) }));
      if (num(p, 'fees') > 0) {
        parts.push(
          p.feesReason === 'dispute_lost'
            ? t('account.earnings.adjustments.reason.beyond.disputeFee', { amount: money(num(p, 'fees')) })
            : t('account.earnings.adjustments.reason.beyond.sellerCancelFees', { amount: money(num(p, 'fees')) }),
        );
      }
      if (parts.length === 0) return row.explanation;
      return t('account.earnings.adjustments.reason.beyond.sentence', { order, parts: parts.join(t('account.earnings.adjustments.partsSeparator')) });
    }
    case 'refund_delivery_fault':
      return t('account.earnings.adjustments.reason.deliveryFault', { order, parcel, amount });
    case 'damage_claim':
      return t('account.earnings.adjustments.reason.damageClaim', { order, parcel, amount });
    case null:
    case undefined:
      // Rows from before 2026-10-22, and every debt repayment: the server words
      // these from `kind` alone, so do we.
      switch (row.kind) {
        case 'refund_clawback':
          return t('account.earnings.adjustments.kindSentence.refundClawback', { amount: money(row.amount) });
        case 'clawback_recovery':
          return t('account.earnings.adjustments.kindSentence.recovery', { amount: money(row.amount) });
        case 'write_off':
          return t('account.earnings.adjustments.kindSentence.writeOff', { amount: money(row.amount) });
        default:
          return row.explanation;
      }
    default:
      return row.explanation;
  }
}

export function adjustmentKindLabel(kind: string, t: Translate): string {
  switch (kind) {
    case 'refund_clawback':
      return t('account.earnings.adjustments.kind.refundClawback');
    case 'clawback_recovery':
      return t('account.earnings.adjustments.kind.recovery');
    case 'write_off':
      return t('account.earnings.adjustments.kind.writeOff');
    default:
      return t('account.earnings.adjustments.kind.unknown');
  }
}

/**
 * Where a taken-back amount came from, e.g. "Taken from your available balance
 * (500 XAF)." `null` when there is nothing to say. Debt is left out: it gets its
 * own "you now owe" line.
 *
 * ⛔ Only for `refund_clawback`. A `clawback_recovery` row fills `takenFrom.debt`
 * with the debt it paid OFF — reading that as "taken from" says the opposite.
 */
export function takenFromSentence(row: EarningsAdjustment, t: Translate, fmt: Formatters): string | null {
  if (row.kind !== 'refund_clawback') return null;
  const money = (n: number) => fmt.currency(n, row.currency);
  const parts: string[] = [];
  if (row.takenFrom.pending > 0) parts.push(t('account.earnings.adjustments.from.pending', { amount: money(row.takenFrom.pending) }));
  if (row.takenFrom.reserve > 0) parts.push(t('account.earnings.adjustments.from.reserve', { amount: money(row.takenFrom.reserve) }));
  if (row.takenFrom.available > 0) parts.push(t('account.earnings.adjustments.from.available', { amount: money(row.takenFrom.available) }));
  if (parts.length === 0) return null;
  return t('account.earnings.adjustments.from.sentence', { parts: fmt.list(parts) });
}

/** The amount this row left owing, or 0. Same ⛔ as `takenFromSentence`. */
export function adjustmentDebt(row: EarningsAdjustment): number {
  return row.kind === 'refund_clawback' ? row.takenFrom.debt : 0;
}
