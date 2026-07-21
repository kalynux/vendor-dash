import { PackageX } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeliveryRejection } from '@/types';

/** Friendly labels for the agency rejection reasons (see orders.md → `delivery.rejection`). */
const REJECTION_REASON_LABELS: Record<string, string> = {
  out_of_coverage_area: 'Out of coverage area',
  capacity_exceeded: 'Agency capacity exceeded',
  invalid_address: 'Invalid delivery address',
  vendor_item_not_ready: 'Item not ready for pickup',
  other: 'Other reason',
};

/** Human-readable label for a rejection reason, with a graceful fallback for unknown values. */
function deliveryRejectionReasonLabel(reason?: string): string {
  if (!reason) return 'Rejected by agency';
  return REJECTION_REASON_LABELS[reason] ?? reason.replace(/_/g, ' ');
}

interface DeliveryRejectionNoticeProps {
  rejection: DeliveryRejection;
  size?: 'sm' | 'xs';
}

/**
 * Inline notice shown on a per-item delivery when the agency declined its shipment.
 * Surfaces the reason + agency note + when, and reminds the vendor the item needs
 * rerouting (the item is left in `pending_agency_reassignment`, so the reassign
 * control sits alongside this notice).
 */
export function DeliveryRejectionNotice({ rejection, size = 'sm' }: DeliveryRejectionNoticeProps) {
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });

  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border border-red-200 bg-red-50 p-2.5 text-red-800',
        size === 'xs' ? 'text-[11px]' : 'text-xs',
      )}
    >
      <div className="flex items-center gap-1.5 font-semibold text-red-700">
        <PackageX className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        Shipment declined by agency
      </div>
      <p className="mt-1">
        <span className="font-medium">Reason:</span> {deliveryRejectionReasonLabel(rejection.reason)}
      </p>
      {rejection.note && (
        <p className="mt-0.5">
          <span className="font-medium">Note:</span> {rejection.note}
        </p>
      )}
      {rejection.rejectedAt && (
        <p className="mt-0.5 text-red-600/80">Declined on {formatDate(rejection.rejectedAt)}</p>
      )}
      <p className="mt-1 text-red-600/80">Reassign this item to another agency to continue.</p>
    </div>
  );
}
