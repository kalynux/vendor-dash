import { cn } from '@/lib/utils';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { OrderStatus } from '@/types';

const STATUS_MAP: Record<string, { class: string; dot: string; labelKey: TranslationKey }> = {
  pending:              { class: 'border-amber-500 text-amber-600 bg-amber-50',     dot: 'bg-amber-500',   labelKey: 'orders.status.pending' },
  processing:           { class: 'border-purple-500 text-purple-600 bg-purple-50',  dot: 'bg-purple-500',  labelKey: 'orders.status.processing' },
  partially_shipped:    { class: 'border-indigo-500 text-indigo-600 bg-indigo-50',  dot: 'bg-indigo-500',  labelKey: 'orders.status.partiallyShipped' },
  shipped:              { class: 'border-blue-500 text-blue-600 bg-blue-50',        dot: 'bg-blue-500',    labelKey: 'orders.status.shipped' },
  partially_delivered:  { class: 'border-lime-500 text-lime-600 bg-lime-50',        dot: 'bg-lime-500',    labelKey: 'orders.status.partiallyDelivered' },
  delivered:            { class: 'border-green-500 text-green-600 bg-green-50',     dot: 'bg-green-500',   labelKey: 'orders.status.delivered' },
  fulfilled:            { class: 'border-teal-500 text-teal-600 bg-teal-50',        dot: 'bg-teal-500',    labelKey: 'orders.status.fulfilled' },
  cancelled:            { class: 'border-red-500 text-red-600 bg-red-50',           dot: 'bg-red-500',     labelKey: 'orders.status.cancelled' },
  returned:             { class: 'border-rose-500 text-rose-600 bg-rose-50',        dot: 'bg-rose-500',    labelKey: 'orders.status.returned' },
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'xs';
}

export function OrderStatusBadge({ status, size = 'sm' }: OrderStatusBadgeProps) {
  const { t } = useTranslation();
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
      {t(config.labelKey)}
    </span>
  );
}
