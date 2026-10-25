import { CirclePause } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';

/**
 * "Earnings on hold" — the ticket's `holds_earnings` is true: a customer
 * reported a problem before the money was released, and it stays paused until
 * the customer or Wi-Mall ends the request (FRONTEND-CHANGELOG-wi-mall-protection).
 * The vendor API carries no pause reason; this flag is the only signal.
 */
export function EarningsHoldBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge
      className={cn(
        'gap-1 border-0 bg-amber-500/10 font-medium text-amber-800 hover:bg-amber-500/10 dark:text-amber-300',
        className,
      )}
    >
      <CirclePause className="h-3 w-3" />
      {t('tickets.earningsHold.badge')}
    </Badge>
  );
}
