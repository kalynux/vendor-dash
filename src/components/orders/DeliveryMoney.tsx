import { Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useFormatters, useTranslation, type TranslationKey } from '@/i18n';
import type { Order, ShipmentDeliveryFee } from '@/types';

// Who paid an order's delivery, and what it cost the vendor — api-doc/vendor/
// orders.md § Delivery money (2026-10-04). Every figure is the API's; nothing
// here adds or splits a fee. Amounts are XAF minor units (whole francs).

/** Reasons worth a sentence. `shop_always` / `shop_never` are what the vendor chose — nothing to explain. */
const REASON_KEYS: Record<string, TranslationKey> = {
  shop_threshold_met: 'orders.deliveryMoney.reason.shop_threshold_met',
  threshold_not_met: 'orders.deliveryMoney.reason.threshold_not_met',
  cap_fallback: 'orders.deliveryMoney.reason.cap_fallback',
};

/**
 * The delivery row of the order summary — part of the customer's total
 * (`total = subtotal + shipping`). Falls back to the old "Free / amount" row
 * on a server that does not send `deliveryPayer` yet.
 */
export function DeliverySummaryRow({ order, className }: { order: Order; className?: string }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const payer = order.deliveryPayer;

  let label: string;
  let value: string;
  if (payer === 'customer') {
    label = t('orders.deliveryMoney.customerPaidLabel');
    // `0` here means the customer hands the fee to the rider in cash — it was never charged online.
    value = order.shipping > 0 ? fmt.currency(order.shipping, order.currency) : t('orders.deliveryMoney.cashToRider');
  } else if (payer === 'vendor') {
    label = t('orders.detail.summary.shipping');
    value = t('orders.deliveryMoney.freeForCustomer');
  } else {
    label = t('orders.detail.summary.shipping');
    value = order.shipping === 0 ? t('orders.detail.summary.free') : fmt.currency(order.shipping, order.currency);
  }

  return (
    <div className={cn('flex justify-between gap-3', className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

/**
 * Under the total: what delivery cost the vendor, and why the customer did or
 * did not pay. Renders nothing on a digital order or an older server.
 */
export function DeliveryCostNote({ order, className }: { order: Order; className?: string }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const payer = order.deliveryPayer;
  if (payer !== 'vendor' && payer !== 'customer') return null;

  const borne = order.vendorBorneDelivery ?? null;
  const reasonKey = order.deliveryPayerReason ? REASON_KEYS[order.deliveryPayerReason] : undefined;

  let line: string | null = null;
  if (payer === 'vendor') {
    line = borne !== null
      ? t('orders.deliveryMoney.youPay', { amount: fmt.currency(borne, order.currency) })
      : t('orders.deliveryMoney.youPayUnpriced');
  } else if (borne !== null && borne > 0) {
    // Customer-paid, but an approved fee change or a covered difference landed on the vendor.
    line = t('orders.deliveryMoney.youPayPart', { amount: fmt.currency(borne, order.currency) });
  }

  if (!line && !reasonKey) return null;
  return (
    <div className={cn('space-y-0.5 text-xs text-muted-foreground', className)}>
      {line && <p className="font-medium text-foreground">{line}</p>}
      {reasonKey && <p>{t(reasonKey)}</p>}
    </div>
  );
}

/** One shipment's delivery money, for the shipments list. Nothing when the server sends none. */
export function ShipmentFeeLine({
  fee,
  currency,
  className,
}: {
  fee: ShipmentDeliveryFee | null | undefined;
  currency: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  if (!fee || fee.fee === null) return null;

  const amount = fmt.currency(fee.fee, currency);
  let who: string;
  if (fee.payer === 'customer') {
    who = fee.vendorBorne !== null && fee.vendorBorne > 0
      ? t('orders.deliveryMoney.shipmentSplit', {
          customer: fmt.currency(fee.customerPaid, currency),
          you: fmt.currency(fee.vendorBorne, currency),
        })
      : t('orders.deliveryMoney.shipmentCustomer');
  } else {
    who = t('orders.deliveryMoney.shipmentYou');
  }

  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      {t('orders.deliveryMoney.shipmentFee', { amount })} · {who}
    </p>
  );
}

/** List-row tag from `deliveryPayer`. Nothing for digital orders or older servers. */
export function DeliveryPayerTag({ order }: { order: Order }) {
  const { t } = useTranslation();
  if (order.deliveryPayer !== 'vendor' && order.deliveryPayer !== 'customer') return null;
  const isVendor = order.deliveryPayer === 'vendor';
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 text-[10px] px-1.5 py-0 h-4',
        isVendor ? 'border-green-300 text-green-700 bg-green-50' : 'border-slate-300 text-slate-700 bg-slate-50',
      )}
    >
      <Truck className="w-2.5 h-2.5" />
      {t(isVendor ? 'orders.deliveryMoney.tagFree' : 'orders.deliveryMoney.tagCustomer')}
    </Badge>
  );
}
