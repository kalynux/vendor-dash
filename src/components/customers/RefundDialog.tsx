import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, AlertTriangle, Ban } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  REFUND_REASON_KEYS, REFUND_REASON_MAX,
} from '@/components/customers/customer.constants';
import { useTranslation, useFormatters, useApiError, type TranslationKey } from '@/i18n';
import { fetchRefundEligibility, refundOrder } from '@/services/customers.service';
import type { RefundEligibility, RefundResult, ReturnShippingPayer } from '@/types/customers.types';

interface RefundDialogProps {
  orderId: string | null;
  orderNumber?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful refund so the caller can refresh order + stats. */
  onRefunded: (result: RefundResult) => void;
}

const RETURN_SHIPPING_PAYER_KEYS: Record<ReturnShippingPayer, TranslationKey> = {
  vendor: 'customers.returnPayer.vendor',
  customer: 'customers.returnPayer.customer',
  customer_reimbursed_if_defect: 'customers.returnPayer.customer_reimbursed_if_defect',
};

export function RefundDialog({ orderId, orderNumber, open, onOpenChange, onRefunded }: RefundDialogProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState<RefundEligibility | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !orderId) return;
    let active = true;
    setLoading(true);
    setLoadError(null);
    setEligibility(null);
    setReason('');
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
  const amountNum = Number(amount);
  const amountInvalid =
    amount.trim() === '' || Number.isNaN(amountNum) || amountNum <= 0 || amountNum > max;

  async function handleRefund() {
    if (!orderId || !eligibility?.eligible || amountInvalid) return;
    setSubmitting(true);
    try {
      const result = await refundOrder(orderId, {
        amount: amountNum,
        reason: reason.trim() || undefined,
      });
      toast.success(
        result.fullyRefunded
          ? t('customers.refund.fullyRefunded')
          : t('customers.refund.partiallyRefunded'),
      );
      onRefunded(result);
      onOpenChange(false);
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'customers.errors.refundFailed' });
      // Re-check eligibility — state may have changed (e.g. now fully refunded).
      if (orderId) fetchRefundEligibility(orderId).then(setEligibility).catch(() => {});
    } finally {
      setSubmitting(false);
    }
  }

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
          <DialogDescription>{t('customers.refund.description')}</DialogDescription>
        </DialogHeader>

        {loading ? (
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

            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="refund-amount">{t('customers.refund.amount', { currency })}</Label>
              <Input
                id="refund-amount"
                type="number"
                inputMode="numeric"
                min={1}
                max={max}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={amountInvalid && amount.trim() !== ''}
              />
              <p className="text-xs text-muted-foreground">
                {t('customers.refund.amountHelp', { max: fmt.currency(max, currency) })}
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
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
