import { AlertTriangle, Clock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { refundStatusBadgeKey } from '@/components/customers/customer.constants';
import type { RefundRequestStatus } from '@/types/customers.types';

/**
 * Stands where the Refund button was while a refund of the order is under way
 * (`openRefundRequest` on the eligibility answer). Not a button: there is
 * nothing to press until Wi-Mall has finished with the request.
 */
export function RefundRequestChip({
  status,
  className,
}: {
  status: RefundRequestStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  const Icon = status === 'failed' ? AlertTriangle : Clock;
  return (
    <div
      role="status"
      className={cn(
        'inline-flex h-8 items-center justify-center gap-2 rounded-md border border-dashed px-3 text-sm text-muted-foreground',
        className,
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', status === 'failed' && 'text-amber-600')} />
      <span className="truncate">{t(refundStatusBadgeKey(status))}</span>
    </div>
  );
}
