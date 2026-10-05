import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, AlertTriangle, Ban, CheckCircle2, Clock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  REFUND_REASON_KEYS, REFUND_REASON_MAX, refundStatusNote,
} from '@/components/customers/customer.constants';
import { useTranslation, useFormatters, useApiError, type TranslationKey } from '@/i18n';
import { fetchRefundEligibility, refundOrder } from '@/services/customers.service';
import type { RefundEligibility, RefundResult, ReturnShippingPayer } from '@/types/customers.types';

interface RefundDialogProps {
  orderId: string | null;
  orderNumber?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once a refund request is opened, so the caller can refresh order + stats. */
  onRefunded: (result: RefundResult) => void;
}

const RETURN_SHIPPING_PAYER_KEYS: Record<ReturnShippingPayer, TranslationKey> = {
  vendor: 'customers.returnPayer.vendor',
  customer: 'customers.returnPayer.customer',
  customer_reimbursed_if_defect: 'customers.returnPayer.customer_reimbursed_if_defect',
};

/**
 * Opens a refund REQUEST (since 2026-10-05). The click no longer finishes the
 * refund: a card is refunded at once, mobile money is sent by transfer, and cash
 * on delivery waits for Wi-Mall's approval and the courier's cash. So after the
 * click the dialog stays open and shows what the server says happened —
 * `status`, and its own gross / fee / net figures — instead of a "refunded" toast.
 */
export function RefundDialog({ orderId, orderNumber, open, onOpenChange, onRefunded }: RefundDialogProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState<RefundEligibility | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [itemDefective, setItemDefective] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RefundResult | null>(null);

  useEffect(() => {
    if (!open || !orderId) return;
    let active = true;
    setLoading(true);
    setLoadError(null);
    setEligibility(null);
    setResult(null);
    setReason('');
    setItemDefective(false);
    fetchRefundEligibility(orderId)
      .then((data) => {
        if (!active) return;
        setEligibility(data);
        setAmount(data.eligible ? String(data.maxRefundable) : '');
      })
      .catch((err) => {
        if (active) setLoadError(apiError.resolve(err, { fallbackKey: 'customers.errors.eligibilityFailed' }));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, orderId, apiError]);

  const currency = eligibility?.currency ?? 'XAF';
  const max = eligibility?.maxRefundable ?? 0;
  const offerDefective = eligibility?.returnShippingPayer === 'customer_reimbursed_if_defect';
  const amountNum = Number(amount);
  // "Item defective" lets the delivery money come back too, and the eligibility
  // answer doesn't say how much that adds. So with the box ticked an empty field
  // means "the most allowed" (the server's default) and the server checks the cap.
  const amountEmptyAllowed = itemDefective && amount.trim() === '';
  const amountInvalid = amountEmptyAllowed
    ? false
    : amount.trim() === '' ||
      !Number.isInteger(amountNum) ||
      amountNum <= 0 ||
      (!itemDefective && amountNum > max);

  function toggleDefective(checked: boolean) {
    setItemDefective(checked);
    setAmount(checked ? '' : String(max));
  }

  async function handleRefund() {
    if (!orderId || !eligibility?.eligible || amountInvalid) return;
    setSubmitting(true);
    try {
      const res = await refundOrder(orderId, {
        amount: amountEmptyAllowed ? undefined : amountNum,
        reason: reason.trim() || undefined,
        itemDefective: offerDefective && itemDefective ? true : undefined,
      });
      setResult(res);
      onRefunded(res);
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'customers.errors.refundFailed' });
      // Re-check eligibility — state may have changed (e.g. a refund is now open).
      if (orderId) fetchRefundEligibility(orderId).then(setEligibility).catch(() => {});
    } finally {
      setSubmitting(false);
    }
  }

  const openRequest = eligibility?.openRefundRequest ?? null;

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            {t('customers.refund.title', {
              order: orderNumber ?? t('customers.refund.fallbackOrder'),
            })}
          </DialogTitle>
          {!result && <DialogDescription>{t('customers.refund.description')}</DialogDescription>}
        </DialogHeader>

        {result ? (
          <RefundOutcome result={result} />
        ) : loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{loadError}</p>
          </div>
        ) : eligibility && !eligibility.eligible && openRequest ? (
          // A refund is already under way — say where it is rather than "not refundable".
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t('customers.refund.alreadyOpen')}</p>
            <p className="text-sm text-muted-foreground">
              {refundStatusNote(openRequest.status, t, { channel: eligibility.paymentChannel })}
            </p>
          </div>
        ) : eligibility && !eligibility.eligible ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Ban className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t('customers.refund.notRefundable')}</p>
            <p className="text-sm text-muted-foreground">
              {eligibility.reasonCode
                ? t(REFUND_REASON_KEYS[eligibility.reasonCode])
                : t('customers.refund.notEligible')}
            </p>
          </div>
        ) : eligibility ? (
          <div className="space-y-4 py-1">
            {/* Balance summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('customers.refund.maxRefundable')}</p>
                <p className="text-lg font-semibold">{fmt.currency(eligibility.maxRefundable, currency)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('customers.refund.remaining')}</p>
                <p className="text-lg font-semibold">{fmt.currency(eligibility.remaining, currency)}</p>
              </div>
            </div>

            <HowItIsSent eligibility={eligibility} />

            {/* Return-policy info (display-only) */}
            {(eligibility.refundProcessingDays != null || eligibility.returnShippingPayer != null) && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {eligibility.refundProcessingDays != null && (
                  <p>{t('customers.refund.settlesIn', { days: eligibility.refundProcessingDays })}</p>
                )}
                {eligibility.returnShippingPayer != null && (
                  <p>
                    {t('customers.refund.returnShipping', {
                      payer: t(RETURN_SHIPPING_PAYER_KEYS[eligibility.returnShippingPayer]),
                    })}
                  </p>
                )}
              </div>
            )}

            {offerDefective && (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="refund-item-defective"
                  checked={itemDefective}
                  onCheckedChange={(v) => toggleDefective(v === true)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="refund-item-defective" className="text-sm font-normal leading-snug">
                    {t('customers.refund.itemDefective')}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t('customers.refund.itemDefectiveHelp')}</p>
                </div>
              </div>
            )}

            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="refund-amount">{t('customers.refund.amount', { currency })}</Label>
              <Input
                id="refund-amount"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                max={itemDefective ? undefined : max}
                value={amount}
                placeholder={itemDefective ? t('customers.refund.amountDefectivePlaceholder') : undefined}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={amountInvalid && amount.trim() !== ''}
              />
              <p className="text-xs text-muted-foreground">
                {itemDefective
                  ? t('customers.refund.amountDefectiveHelp')
                  : t('customers.refund.amountHelp', { max: fmt.currency(max, currency) })}
              </p>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="refund-reason">{t('customers.refund.reason')}</Label>
              <Textarea
                id="refund-reason"
                rows={3}
                maxLength={REFUND_REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('customers.refund.reasonPlaceholder')}
              />
            </div>

            <p className="text-xs text-muted-foreground">{t('customers.refund.earningsNote')}</p>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          {result ? (
            <Button onClick={() => onOpenChange(false)}>{t('common.actions.done')}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                {eligibility?.eligible ? t('common.actions.cancel') : t('common.actions.close')}
              </Button>
              {eligibility?.eligible && (
                <Button onClick={handleRefund} disabled={submitting || amountInvalid}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  {amount && !amountInvalid
                    ? t('customers.refund.submitAmount', { amount: fmt.currency(amountNum, currency) })
                    : t('customers.refund.submit')}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * How the money will reach the customer, said BEFORE the click. Only the rate is
 * named here — the fee itself is the server's figure, shown after the click.
 */
function HowItIsSent({ eligibility }: { eligibility: RefundEligibility }) {
  const { t } = useTranslation();
  const channel = eligibility.paymentChannel ?? null;
  // An older server sends neither field: say nothing rather than guess.
  if (channel === null && eligibility.autoSend === undefined) return null;

  const channelKey: TranslationKey | null =
    channel === 'card'
      ? 'customers.refund.how.card'
      : channel === 'mobile_money'
        ? 'customers.refund.how.mobileMoney'
        : channel === 'cod'
          ? 'customers.refund.how.cod'
          : null;

  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">
        {eligibility.autoSend ? t('customers.refund.how.autoSend') : t('customers.refund.how.needsApproval')}
      </p>
      {channelKey && <p className="text-muted-foreground">{t(channelKey)}</p>}
    </div>
  );
}

/** What the server says happened, in its own figures. */
function RefundOutcome({ result }: { result: RefundResult }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const money = (n: number) => fmt.currency(n, result.currency);

  const Icon = result.status === 'completed' ? CheckCircle2 : result.status === 'failed' ? AlertTriangle : Clock;
  const iconClass =
    result.status === 'completed'
      ? 'text-green-600'
      : result.status === 'failed'
        ? 'text-amber-600'
        : 'text-muted-foreground';

  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className={`h-6 w-6 ${iconClass}`} />
      </div>
      <p className="text-sm font-medium">
        {refundStatusNote(result.status, t, {
          channel: result.paymentChannel,
          destinationMasked: result.destinationMasked,
        })}
      </p>
      <p className="text-sm text-muted-foreground">
        {result.feeAmount > 0
          ? t('customers.refund.result.amountWithFee', {
              gross: money(result.grossAmount),
              net: money(result.netAmount),
              fee: money(result.feeAmount),
            })
          : t('customers.refund.result.amountNoFee', {
              gross: money(result.grossAmount),
            })}
      </p>
    </div>
  );
}
