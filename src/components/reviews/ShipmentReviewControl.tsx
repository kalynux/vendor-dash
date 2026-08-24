import { useCallback, useState } from 'react';
import { CheckCircle2, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ReviewDeliveryDialog } from '@/components/reviews/ReviewDeliveryDialog';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface ShipmentReviewControlProps {
  /** `undefined` on a legacy shipment that carries no id — nothing to review. */
  shipmentId?: string;
  /** The shipment's own `deliveryStatus`. */
  deliveryStatus?: string;
  agencyName?: string | null;
  agentName?: string | null;
  className?: string;
}

/**
 * "Rate this delivery" on one shipment row, plus the dialog behind it.
 *
 * Self-contained on purpose: both order-detail surfaces (desktop card and mobile
 * sheet) render the same shipment list, and threading a reviewed-set through two
 * unrelated components to keep them in step would be more state than the feature
 * is worth.
 *
 * 🔴 Only `delivered` gets the control. `agent_delivered` is the agent's claim,
 * not the confirmed state, and the backend refuses it with `422
 * REVIEW_NOT_ELIGIBLE` — offering a button that can only fail is worse than not
 * offering one. Everything past that gate is still confirmed by the eligibility
 * call inside the dialog, because "delivered" is necessary but not sufficient:
 * a shipment with no agent bound to it is not reviewable either.
 */
export function ShipmentReviewControl({
  shipmentId,
  deliveryStatus,
  agencyName,
  agentName,
  className,
}: ShipmentReviewControlProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Session-local. Set both by a successful submit and by an eligibility answer
  // of "already reviewed", so re-opening the order does not offer a second
  // attempt at a surface that has no second attempt.
  const [reviewed, setReviewed] = useState(false);
  // Stable identity: the dialog re-runs its eligibility check whenever this
  // changes, so an inline arrow would refetch every time an ancestor happened to
  // re-render while the dialog was open.
  const handleReviewed = useCallback(() => setReviewed(true), []);

  if (!shipmentId || deliveryStatus !== 'delivered') return null;

  if (reviewed) {
    return (
      <p
        className={cn(
          'flex items-center gap-1.5 text-xs font-medium text-green-600',
          className,
        )}
      >
        <CheckCircle2 className="size-3.5" />
        {t('orders.review.reviewed')}
      </p>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn('h-7 gap-1.5 px-2.5 text-xs', className)}
        onClick={() => setOpen(true)}
      >
        <Star className="size-3.5" />
        {t('orders.review.action')}
      </Button>

      {/*
        Mounted only while open so the eligibility request fires on intent, not
        on every order a vendor happens to look at.
      */}
      {open && (
        <ReviewDeliveryDialog
          open={open}
          onOpenChange={setOpen}
          shipmentId={shipmentId}
          agencyName={agencyName}
          agentName={agentName}
          onReviewed={handleReviewed}
        />
      )}
    </>
  );
}
