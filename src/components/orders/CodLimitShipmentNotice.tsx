import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFormatters, useTranslation, type TranslationKey } from '@/i18n';
import type { OrderItemDelivery } from '@/types';

const HOLD_KEYS: Record<string, TranslationKey> = {
  agency_limit: 'orders.codLimit.hold.agency_limit',
  vendor_terms: 'orders.codLimit.hold.vendor_terms',
};

interface CodLimitShipmentNoticeProps {
  shipment: OrderItemDelivery;
  currency: string;
  /** Dispatch the order again with `force: true`. Absent → no button. */
  onDispatchAnyway?: () => void;
  dispatching?: boolean;
  size?: 'sm' | 'xs';
}

/**
 * A shipment's COD-limit state: a block when auto-dispatch held it back
 * (`codLimitHold`), an audit line when it went out over a limit
 * (`codLimitForce`). Copy comes from `kind` — the order timeline's sentence
 * always blames the agency, even when the vendor's own terms held it.
 */
export function CodLimitShipmentNotice({
  shipment,
  currency,
  onDispatchAnyway,
  dispatching = false,
  size = 'sm',
}: CodLimitShipmentNoticeProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { codLimitHold: hold, codLimitForce: force } = shipment;
  if (!hold && !force) return null;

  const text = size === 'xs' ? 'text-[11px]' : 'text-xs';

  return (
    <>
      {hold && (
        <div role="alert" className={cn('rounded-md border border-amber-200 bg-amber-50 p-2.5 text-amber-900 space-y-1', text)}>
          <p className="flex items-start gap-1.5 font-semibold">
            <AlertTriangle className="mt-px w-3.5 h-3.5 flex-shrink-0" />
            {t(HOLD_KEYS[hold.kind] ?? 'orders.codLimit.hold.unknown')}
          </p>
          <p>
            {t('orders.codLimit.holdNumbers', {
              current: fmt.currency(hold.currentExposure, currency),
              added: fmt.currency(hold.additionalAmount, currency),
              limit: fmt.currency(hold.limit, currency),
            })}
          </p>
          <p className="text-amber-800/80">{t('orders.codLimit.holdNoRetry')}</p>
          {onDispatchAnyway && (
            <Button size="sm" variant="outline" className="mt-1 h-7 gap-1.5 bg-background text-xs" disabled={dispatching} onClick={onDispatchAnyway}>
              {dispatching && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('orders.codLimit.dispatchAnyway')}
            </Button>
          )}
        </div>
      )}
      {force && (
        <p className={cn('flex items-center gap-1.5 text-muted-foreground', text)}>
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
          {t('orders.codLimit.forced', { date: fmt.dateTime(force.forcedAt) })}
        </p>
      )}
    </>
  );
}
