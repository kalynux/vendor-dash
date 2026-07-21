import { cn } from '@/lib/utils';
import type { PaymentStatus } from '@/types';

// Payment-status pill, mirroring OrderStatusBadge styling. `disputed` is called out
// in orange because the order is frozen until the chargeback settles.
const PAYMENT_MAP: Record<string, { class: string; label: string }> = {
  paid:               { class: 'border-green-500 text-green-600 bg-green-50',   label: 'Paid' },
  pending:            { class: 'border-amber-500 text-amber-600 bg-amber-50',   label: 'Pending' },
  // COD only: awaiting the agent's cash handoff, and partially collected across a multi-shipment order.
  AWAITING_PAYMENT:   { class: 'border-amber-500 text-amber-600 bg-amber-50',   label: 'Awaiting Payment' },
  partially_paid:     { class: 'border-blue-500 text-blue-600 bg-blue-50',      label: 'Partially Paid' },
  disputed:           { class: 'border-orange-500 text-orange-600 bg-orange-50', label: 'Disputed' },
  failed:             { class: 'border-red-500 text-red-600 bg-red-50',         label: 'Failed' },
  refunded:           { class: 'border-gray-400 text-gray-600 bg-gray-50',      label: 'Refunded' },
  partially_refunded: { class: 'border-gray-400 text-gray-600 bg-gray-50',      label: 'Partially refunded' },
};

interface PaymentStatusBadgeProps {
  status: PaymentStatus | string;
  size?: 'sm' | 'xs';
  className?: string;
}

export function PaymentStatusBadge({ status, size = 'sm', className }: PaymentStatusBadgeProps) {
  const config = PAYMENT_MAP[status] ?? { class: 'border-gray-300 text-gray-600 bg-gray-50', label: status };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium capitalize',
        size === 'xs' ? 'text-[10px]' : 'text-xs',
        config.class,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
