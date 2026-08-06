import { PackageX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation, useFormatters, type TranslationKey } from '@/i18n';
import type { DeliveryRejection } from '@/types';

/** Friendly labels for the agency rejection reasons (see orders.md → `delivery.rejection`). */
const REJECTION_REASON_KEYS: Record<string, TranslationKey> = {
  out_of_coverage_area: 'agency.rejectionReason.out_of_coverage_area',
  capacity_exceeded: 'agency.rejectionReason.capacity_exceeded',
  invalid_address: 'agency.rejectionReason.invalid_address',
  vendor_item_not_ready: 'agency.rejectionReason.vendor_item_not_ready',
  other: 'agency.rejectionReason.other',
};

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
  const { t } = useTranslation();
  const fmt = useFormatters();

  /** Localized reason, with a graceful fallback for values we don't know. */
  const reasonLabel = (reason?: string): string => {
    if (!reason) return t('agency.rejectionReason.unknown');
    const key = REJECTION_REASON_KEYS[reason];
    return key ? t(key) : reason.replace(/_/g, ' ');
  };

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
        {t('agency.reassign.declinedTitle')}
      </div>
      <p className="mt-1">
        <span className="font-medium">{t('agency.reassign.declinedReason')}</span>{' '}
        {reasonLabel(rejection.reason)}
      </p>
      {rejection.note && (
        <p className="mt-0.5">
          <span className="font-medium">{t('agency.reassign.declinedNote')}</span> {rejection.note}
        </p>
      )}
      {rejection.rejectedAt && (
        <p className="mt-0.5 text-red-600/80">
          {t('agency.reassign.declinedOn', { date: fmt.dateTime(rejection.rejectedAt) })}
        </p>
      )}
      <p className="mt-1 text-red-600/80">{t('agency.reassign.declinedHint')}</p>
    </div>
  );
}
