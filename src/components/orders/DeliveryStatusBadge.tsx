import { cn } from '@/lib/utils';
import { useTranslation, type TranslationKey } from '@/i18n';

const STATUS_MAP: Record<string, { class: string; dot: string; labelKey: TranslationKey }> = {
  pending:                       { class: 'border-amber-500 text-amber-600 bg-amber-50',    dot: 'bg-amber-500',    labelKey: 'orders.deliveryStatus.pending' },
  assigned:                      { class: 'border-blue-500 text-blue-600 bg-blue-50',        dot: 'bg-blue-500',     labelKey: 'orders.deliveryStatus.assigned' },
  picked_up:                     { class: 'border-indigo-500 text-indigo-600 bg-indigo-50',  dot: 'bg-indigo-500',   labelKey: 'orders.deliveryStatus.pickedUp' },
  in_transit:                    { class: 'border-sky-500 text-sky-600 bg-sky-50',           dot: 'bg-sky-500',      labelKey: 'orders.deliveryStatus.inTransit' },
  agent_delivered:               { class: 'border-lime-500 text-lime-600 bg-lime-50',        dot: 'bg-lime-500',     labelKey: 'orders.deliveryStatus.agentDelivered' },
  delivered:                     { class: 'border-green-500 text-green-600 bg-green-50',     dot: 'bg-green-500',    labelKey: 'orders.deliveryStatus.delivered' },
  failed:                        { class: 'border-red-500 text-red-600 bg-red-50',           dot: 'bg-red-500',      labelKey: 'orders.deliveryStatus.failed' },
  returned:                      { class: 'border-rose-500 text-rose-600 bg-rose-50',        dot: 'bg-rose-500',     labelKey: 'orders.deliveryStatus.returned' },
  rejected:                      { class: 'border-red-500 text-red-600 bg-red-50',           dot: 'bg-red-500',      labelKey: 'orders.deliveryStatus.rejected' },
  pending_agency_reassignment:   { class: 'border-orange-500 text-orange-600 bg-orange-50',  dot: 'bg-orange-500',   labelKey: 'orders.deliveryStatus.pendingAgencyReassignment' },
};

interface DeliveryStatusBadgeProps {
  status?: string;
  size?: 'sm' | 'xs';
}

export function DeliveryStatusBadge({ status, size = 'sm' }: DeliveryStatusBadgeProps) {
  const { t } = useTranslation();
  if (!status) return null;
  // Unrecognized values render the raw string rather than a mislabeled fallback
  // (unlike OrderStatusBadge — a wrong "Pending" label on a shipment is misleading).
  const config = STATUS_MAP[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium capitalize',
        size === 'xs' ? 'text-[10px]' : 'text-xs',
        config?.class ?? 'border-gray-300 text-gray-600 bg-gray-50',
      )}
    >
      <span
        className={cn(
          'rounded-full flex-shrink-0',
          size === 'xs' ? 'w-1.5 h-1.5' : 'w-2 h-2',
          config?.dot ?? 'bg-gray-400',
        )}
      />
      {config ? t(config.labelKey) : status}
    </span>
  );
}
