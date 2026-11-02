import { AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { isWaitingForOnlinePart, partialPaymentSentence } from '@/lib/orderStatus';
import { useFormatters, useTranslation } from '@/i18n';
import type { Order } from '@/types';

/**
 * The line that sits with the payment status of a partial-payment order:
 * "6,000 XAF paid online, 14,000 XAF collected in cash at delivery." Renders
 * nothing on every other order.
 */
export function PartialPaymentNote({ order, className }: { order: Order; className?: string }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const text = partialPaymentSentence(order, t, fmt);
  if (!text) return null;
  return (
    <p className={cn('text-xs', isWaitingForOnlinePart(order) ? 'font-medium text-amber-700' : 'text-muted-foreground', className)}>
      {text}
    </p>
  );
}

/**
 * "Don't prepare this order yet", above the order's tabs so it is seen whichever
 * tab is open. Only for a partial order still waiting for its online part: a
 * plain cash order reads the same payment status and SHOULD be prepared.
 */
export function OnlinePartDueBanner({ order, className }: { order: Order; className?: string }) {
  const { t } = useTranslation();
  if (!isWaitingForOnlinePart(order)) return null;
  return (
    <div className={cn('flex items-start gap-3 border-amber-300 bg-amber-50 flex-shrink-0', className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
      <div className="text-sm">
        <p className="font-semibold text-amber-800">{t('orders.partialPayment.dueTitle')}</p>
        <p className="text-amber-700/90 mt-0.5">{t('orders.partialPayment.dueBody')}</p>
      </div>
    </div>
  );
}
