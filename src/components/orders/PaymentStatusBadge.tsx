import { cn } from '@/lib/utils';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { PaymentStatus } from '@/types';

// Payment-status pill, mirroring OrderStatusBadge styling. `disputed` is called out
// in orange because the order is frozen until the chargeback settles.
const PAYMENT_MAP: Record<string, { class: string; labelKey: TranslationKey }> = {
  paid:               { class: 'border-green-500 text-green-600 bg-green-50',   labelKey: 'orders.paymentStatus.paid' },
  pending:            { class: 'border-amber-500 text-amber-600 bg-amber-50',   labelKey: 'orders.paymentStatus.pending' },
  // COD only: awaiting the agent's cash handoff, and partially collected across a multi-shipment order.
  AWAITING_PAYMENT:   { class: 'border-amber-500 text-amber-600 bg-amber-50',   labelKey: 'orders.paymentStatus.awaitingPayment' },
  partially_paid:     { class: 'border-blue-500 text-blue-600 bg-blue-50',      labelKey: 'orders.paymentStatus.partiallyPaid' },
  disputed:           { class: 'border-orange-500 text-orange-600 bg-orange-50', labelKey: 'orders.paymentStatus.disputed' },
  failed:             { class: 'border-red-500 text-red-600 bg-red-50',         labelKey: 'orders.paymentStatus.failed' },
  refunded:           { class: 'border-gray-400 text-gray-600 bg-gray-50',      labelKey: 'orders.paymentStatus.refunded' },
  partially_refunded: { class: 'border-gray-400 text-gray-600 bg-gray-50',      labelKey: 'orders.paymentStatus.partiallyRefunded' },
};

interface PaymentStatusBadgeProps {
  status: PaymentStatus | string;
  size?: 'sm' | 'xs';
  className?: string;
}

export function PaymentStatusBadge({ status, size = 'sm', className }: PaymentStatusBadgeProps) {
  const { t } = useTranslation();
  const config = PAYMENT_MAP[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium capitalize',
        size === 'xs' ? 'text-[10px]' : 'text-xs',
        config?.class ?? 'border-gray-300 text-gray-600 bg-gray-50',
        className,
      )}
    >
      {/* An unrecognized status renders raw rather than being mislabeled. */}
      {config ? t(config.labelKey) : status}
    </span>
  );
}
