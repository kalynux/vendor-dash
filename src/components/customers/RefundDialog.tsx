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
  formatMoney, REFUND_REASON_LABELS, REFUND_REASON_MAX,
} from '@/components/customers/customer.constants';
import { fetchRefundEligibility, refundOrder } from '@/services/customers.service';
import { ApiError } from '@/types/api';
import type { RefundEligibility, RefundResult } from '@/types/customers.types';

interface RefundDialogProps {
  orderId: string | null;
  orderNumber?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful refund so the caller can refresh order + stats. */
  onRefunded: (result: RefundResult) => void;
}

const REFUND_ERROR_LABELS: Record<string, string> = {
  REFUND_POLICY_DISABLED: 'Refunds are disabled by your return policy.',
  REFUND_WINDOW_EXPIRED: 'The return window for this order has expired.',
  REFUND_NOT_ELIGIBLE: 'This order is not eligible for a refund.',
  REFUND_ORDER_NOT_PAID: 'This order has not been paid.',
  REFUND_ALREADY_FULLY_REFUNDED: 'This order has already been fully refunded.',
  REFUND_PAYMENT_NOT_FOUND: 'No successful payment to refund.',
  REFUND_AMOUNT_EXCEEDS_MAX: 'The amount exceeds the maximum you can refund.',
  REFUND_GATEWAY_NOT_SUPPORTED: 'This payment gateway does not support refunds.',
  REFUND_GATEWAY_FAILED: 'The payment gateway rejected the refund. Try again later.',
  ORDER_NOT_FOUND: 'Order not found.',
};

export function RefundDialog({ orderId, orderNumber, open, onOpenChange, onRefunded }: RefundDialogProps) {
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
        if (active) setLoadError(err instanceof ApiError ? err.message : 'Failed to check eligibility');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, orderId]);

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
      toast.success(result.fullyRefunded ? 'Order fully refunded' : 'Partial refund processed');
      onRefunded(result);
      onOpenChange(false);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      toast.error(
        REFUND_ERROR_LABELS[code] ?? (err instanceof ApiError ? err.message : 'Refund failed'),
      );
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
            Refund {orderNumber ?? 'order'}
          </DialogTitle>
          <DialogDescription>
            Refunds are processed live through the payment gateway and can't be undone.
          </DialogDescription>
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
            <p className="text-sm font-medium">This order can't be refunded</p>
            <p className="text-sm text-muted-foreground">
              {eligibility.reasonCode
                ? REFUND_REASON_LABELS[eligibility.reasonCode]
                : 'It is not currently eligible for a refund.'}
            </p>
          </div>
        ) : eligibility ? (
          <div className="space-y-4 py-1">
            {/* Balance summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Max refundable</p>
                <p className="text-lg font-semibold">{formatMoney(eligibility.maxRefundable, currency)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Remaining balance</p>
                <p className="text-lg font-semibold">{formatMoney(eligibility.remaining, currency)}</p>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="refund-amount">Amount ({currency})</Label>
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
                You can refund up to {formatMoney(max, currency)}. Lower it for a partial refund.
              </p>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="refund-reason">Reason (optional)</Label>
              <Textarea
                id="refund-reason"
                rows={3}
                maxLength={REFUND_REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Shared with the payment gateway and stored on the refund."
              />
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {eligibility?.eligible ? 'Cancel' : 'Close'}
          </Button>
          {eligibility?.eligible && (
            <Button onClick={handleRefund} disabled={submitting || amountInvalid}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Refund {amount && !amountInvalid ? formatMoney(amountNum, currency) : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
