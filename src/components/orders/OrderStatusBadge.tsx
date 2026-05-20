import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types';

const STATUS_MAP: Record<string, { class: string; dot: string; label: string }> = {
  delivered:   { class: 'border-green-500 text-green-600 bg-green-50',    dot: 'bg-green-500',   label: 'Delivered' },
  shipped:     { class: 'border-blue-500 text-blue-600 bg-blue-50',       dot: 'bg-blue-500',    label: 'Shipped' },
  pending:     { class: 'border-amber-500 text-amber-600 bg-amber-50',    dot: 'bg-amber-500',   label: 'Pending' },
  processing:  { class: 'border-purple-500 text-purple-600 bg-purple-50', dot: 'bg-purple-500',  label: 'Processing' },
  confirmed:   { class: 'border-blue-500 text-blue-600 bg-blue-50',       dot: 'bg-blue-500',    label: 'Confirmed' },
  cancelled:   { class: 'border-red-500 text-red-600 bg-red-50',          dot: 'bg-red-500',     label: 'Cancelled' },
  refunded:    { class: 'border-gray-400 text-gray-600 bg-gray-50',       dot: 'bg-gray-400',    label: 'Refunded' },
  fulfilled:   { class: 'border-teal-500 text-teal-600 bg-teal-50',       dot: 'bg-teal-500',    label: 'Fulfilled' },
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'xs';
}

export function OrderStatusBadge({ status, size = 'sm' }: OrderStatusBadgeProps) {
  const config = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium',
        size === 'xs' ? 'text-[10px]' : 'text-xs',
        config.class,
      )}
    >
      <span
        className={cn(
          'rounded-full flex-shrink-0',
          size === 'xs' ? 'w-1.5 h-1.5' : 'w-2 h-2',
          config.dot,
        )}
      />
      {config.label}
    </span>
  );
}
