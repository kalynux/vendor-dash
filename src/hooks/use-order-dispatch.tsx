import { useState } from 'react';
import { toast } from 'sonner';
import { CodAgencyRestrictedDialog } from '@/components/orders/CodAgencyRestrictedDialog';
import { CodLimitDialog } from '@/components/orders/CodLimitDialog';
import { dispatchOrder, getOrderErrorMessage } from '@/services/orders.service';
import { ApiError } from '@/types/api';
import {
  COD_AGENCY_LIMIT_EXCEEDED,
  COD_AGENCY_RESTRICTED,
  readCodLimitDetails,
  readCodRestrictedAgencyId,
  type CodLimitExceededDetails,
} from '@/types/cod-limits.types';
import { useTranslation } from '@/i18n';
import type { Order } from '@/types';

interface UseOrderDispatchOptions {
  onDispatched: (order: Order) => void;
  /** "Choose another agency" in the COD dialogs; gets the over-limit / restricted agency's id. */
  onChooseAnotherAgency?: (agencyId: string) => void;
}

/**
 * Dispatch an order to its agency, with the COD-limit gate (2026-10-02).
 *
 * The first attempt never forces. On `422 COD_AGENCY_LIMIT_EXCEEDED` the
 * returned `dialog` opens with the figures, and only the vendor's
 * "Dispatch anyway" resends with `force: true`. Render `dialog` once.
 *
 * `422 COD_AGENCY_RESTRICTED` (2026-10-10) is never retried — forced or not,
 * it opens a dialog whose only way forward is another agency.
 */
export function useOrderDispatch(order: Order | null, { onDispatched, onChooseAnotherAgency }: UseOrderDispatchOptions) {
  const { t } = useTranslation();
  const [dispatching, setDispatching] = useState(false);
  const [overLimit, setOverLimit] = useState<CodLimitExceededDetails | null>(null);
  /** The agency barred from cash on delivery; the dialog is open while this is set. */
  const [restricted, setRestricted] = useState<{ agencyId: string } | null>(null);

  const run = async (force: boolean) => {
    if (!order) return;
    setDispatching(true);
    try {
      const { order: updated } = await dispatchOrder(order.id, { force });
      setOverLimit(null);
      onDispatched(updated);
      toast.success(t('orders.toast.dispatched'));
    } catch (err) {
      if (err instanceof ApiError && err.code === COD_AGENCY_RESTRICTED) {
        setOverLimit(null);
        setRestricted({ agencyId: readCodRestrictedAgencyId(err.detailsObject) });
        return;
      }
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
    <>
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
      <CodAgencyRestrictedDialog
        open={restricted !== null}
        onClose={() => setRestricted(null)}
        onChooseAnotherAgency={
          onChooseAnotherAgency && restricted
            ? () => {
                const agencyId = restricted.agencyId;
                setRestricted(null);
                onChooseAnotherAgency(agencyId);
              }
            : undefined
        }
      />
    </>
  );

  return { dispatch: () => void run(false), dispatching, dialog };
}
