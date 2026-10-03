import { useState } from 'react';
import { toast } from 'sonner';
import { CodLimitDialog } from '@/components/orders/CodLimitDialog';
import { dispatchOrder, getOrderErrorMessage } from '@/services/orders.service';
import { ApiError } from '@/types/api';
import { COD_AGENCY_LIMIT_EXCEEDED, readCodLimitDetails, type CodLimitExceededDetails } from '@/types/cod-limits.types';
import { useTranslation } from '@/i18n';
import type { Order } from '@/types';

interface UseOrderDispatchOptions {
  onDispatched: (order: Order) => void;
  /** "Choose another agency" in the COD-limit dialog; gets the over-limit agency's id. */
  onChooseAnotherAgency?: (agencyId: string) => void;
}

/**
 * Dispatch an order to its agency, with the COD-limit gate (2026-10-02).
 *
 * The first attempt never forces. On `422 COD_AGENCY_LIMIT_EXCEEDED` the
 * returned `dialog` opens with the figures, and only the vendor's
 * "Dispatch anyway" resends with `force: true`. Render `dialog` once.
 */
export function useOrderDispatch(order: Order | null, { onDispatched, onChooseAnotherAgency }: UseOrderDispatchOptions) {
  const { t } = useTranslation();
  const [dispatching, setDispatching] = useState(false);
  const [overLimit, setOverLimit] = useState<CodLimitExceededDetails | null>(null);

  const run = async (force: boolean) => {
    if (!order) return;
    setDispatching(true);
    try {
      const { order: updated } = await dispatchOrder(order.id, { force });
      setOverLimit(null);
      onDispatched(updated);
      toast.success(t('orders.toast.dispatched'));
    } catch (err) {
      const details =
        !force && err instanceof ApiError && err.code === COD_AGENCY_LIMIT_EXCEEDED
          ? readCodLimitDetails(err.detailsObject)
          : null;
      if (details) {
        setOverLimit(details);
      } else {
        setOverLimit(null);
        toast.error(getOrderErrorMessage(err));
      }
    } finally {
      setDispatching(false);
    }
  };

  const dialog = (
    <CodLimitDialog
      details={overLimit}
      currency={order?.currency ?? 'XAF'}
      mode="dispatch"
      forcing={dispatching}
      onForce={() => void run(true)}
      onClose={() => setOverLimit(null)}
      onChooseAnotherAgency={
        onChooseAnotherAgency && overLimit
          ? () => {
              const agencyId = overLimit.agencyId;
              setOverLimit(null);
              onChooseAnotherAgency(agencyId);
            }
          : undefined
      }
    />
  );

  return { dispatch: () => void run(false), dispatching, dialog };
}
