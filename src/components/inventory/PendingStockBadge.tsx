import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';

/** The minimum a surface needs to explain a quantity that did not land. */
export interface PendingStockInfo {
  requestId: string;
  requestedQuantity: number;
}

/**
 * "120 → 90 · pending" — the badge that explains why a stock input snapped back
 * to the old number.
 *
 * For an agency-warehoused SKU the quantity is a proposal until the agency signs
 * off, so the form shows the server's figure and this says what is queued. Links
 * into the stock-request inbox, where it can be withdrawn.
 */
export function PendingStockBadge({
  currentStock,
  pending,
  className,
}: {
  currentStock: number;
  pending: PendingStockInfo;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/dashboard/inventory/requests?view=${encodeURIComponent(pending.requestId)}`}
      title={t('inventory.pending.awaitingApproval')}
      className={cn(
        'inline-block rounded border border-amber-500/40 bg-amber-500/5 px-1.5 py-0.5 text-[11px] leading-tight text-amber-700 tabular-nums hover:bg-amber-500/10 dark:text-amber-400',
        className,
      )}
    >
      {t('inventory.pending.badge', {
        from: currentStock,
        to: pending.requestedQuantity,
      })}
    </Link>
  );
}

export default PendingStockBadge;
