import { cn } from '@/lib/utils';

const STATUS_MAP: Record<string, { class: string; dot: string; label: string }> = {
  pending:                       { class: 'border-amber-500 text-amber-600 bg-amber-50',    dot: 'bg-amber-500',    label: 'Pending' },
  assigned:                      { class: 'border-blue-500 text-blue-600 bg-blue-50',        dot: 'bg-blue-500',     label: 'Assigned' },
  picked_up:                     { class: 'border-indigo-500 text-indigo-600 bg-indigo-50',  dot: 'bg-indigo-500',   label: 'Picked Up' },
  in_transit:                    { class: 'border-sky-500 text-sky-600 bg-sky-50',           dot: 'bg-sky-500',      label: 'In Transit' },
  agent_delivered:               { class: 'border-lime-500 text-lime-600 bg-lime-50',        dot: 'bg-lime-500',     label: 'Delivered by Agent' },
  delivered:                     { class: 'border-green-500 text-green-600 bg-green-50',     dot: 'bg-green-500',    label: 'Delivered' },
  failed:                        { class: 'border-red-500 text-red-600 bg-red-50',           dot: 'bg-red-500',      label: 'Failed' },
  returned:                      { class: 'border-rose-500 text-rose-600 bg-rose-50',        dot: 'bg-rose-500',     label: 'Returned' },
  rejected:                      { class: 'border-red-500 text-red-600 bg-red-50',           dot: 'bg-red-500',      label: 'Rejected' },
  pending_agency_reassignment:   { class: 'border-orange-500 text-orange-600 bg-orange-50',  dot: 'bg-orange-500',   label: 'Needs Reassignment' },
};

interface DeliveryStatusBadgeProps {
  status?: string;
  size?: 'sm' | 'xs';
}

export function DeliveryStatusBadge({ status, size = 'sm' }: DeliveryStatusBadgeProps) {
  if (!status) return null;
  // Unrecognized values render the raw string rather than a mislabeled fallback
  // (unlike OrderStatusBadge — a wrong "Pending" label on a shipment is misleading).
  const config = STATUS_MAP[status] ?? {
    class: 'border-gray-300 text-gray-600 bg-gray-50',
    dot: 'bg-gray-400',
    label: status,
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium capitalize',
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
