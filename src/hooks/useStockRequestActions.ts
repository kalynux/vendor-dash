import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  approveStockRequest,
  fetchStockRequestById,
  rejectStockRequest,
  withdrawStockRequest,
} from '@/services/stockRequests.service';
import { ApiError } from '@/types/api';
import type { StockRequestDto } from '@/types/stock-requests.types';
import { useApiError, useTranslation } from '@/i18n';

export interface UseStockRequestActionsOptions {
  /**
   * Called with the authoritative DTO after any resolution — success OR a
   * conflict we recovered from. Splice it into local state rather than
   * refetching the page.
   */
  onChanged?: (dto: StockRequestDto) => void;
  /** Called after an approve, which WRITES `variant.stock` — refresh stock views. */
  onStockWritten?: () => void;
}

/**
 * Approve / reject / withdraw a stock request.
 *
 * `pendingKey` is a `verb:id` string so exactly one button spins across the
 * whole list.
 *
 * The deliberate inversion vs. the connections hook: `STOCK_REQUEST_NOT_PENDING`
 * and `STOCK_REQUEST_NOT_YOURS` mean **reload, do not retry**. Both are
 * compare-and-set misses — the row exists and the other party got there first,
 * so our buttons were stale. Re-sending would apply an intent formed against a
 * state that no longer holds. We refetch that one request and hand the truth
 * back before toasting.
 */
export function useStockRequestActions({
  onChanged,
  onStockWritten,
}: UseStockRequestActionsOptions = {}) {
  const { t } = useTranslation();
  const apiError = useApiError();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const run = useCallback(
    async (
      key: string,
      id: string,
      action: () => Promise<StockRequestDto>,
      successMessage: string,
    ): Promise<StockRequestDto | null> => {
      setPendingKey(key);
      try {
        const dto = await action();
        toast.success(successMessage);
        onChanged?.(dto);
        return dto;
      } catch (err) {
        if (
          err instanceof ApiError &&
          (err.code === 'STOCK_REQUEST_NOT_PENDING' || err.code === 'STOCK_REQUEST_NOT_YOURS')
        ) {
          const fresh = await fetchStockRequestById(id).catch(() => null);
          if (fresh) onChanged?.(fresh);
        }
        apiError.toast(err, {
          context: 'stockRequest',
          fallbackKey: 'inventory.requests.errors.actionFailed',
        });
        return null;
      } finally {
        setPendingKey(null);
      }
    },
    [onChanged, apiError],
  );

  const approve = useCallback(
    async (id: string, requestedQuantity: number) => {
      const dto = await run(
        `approve:${id}`,
        id,
        () => approveStockRequest(id),
        t('inventory.requests.toast.approved', { quantity: requestedQuantity }),
      );
      // An approve writes variant.stock in the same transaction, so alerts and
      // history are now stale.
      if (dto) onStockWritten?.();
      return dto;
    },
    [run, t, onStockWritten],
  );

  const reject = useCallback(
    (id: string, reason?: string) =>
      run(
        `reject:${id}`,
        id,
        () => rejectStockRequest(id, reason),
        t('inventory.requests.toast.rejected'),
      ),
    [run, t],
  );

  const withdraw = useCallback(
    (id: string) =>
      run(
        `withdraw:${id}`,
        id,
        () => withdrawStockRequest(id),
        t('inventory.requests.toast.withdrawn'),
      ),
    [run, t],
  );

  return { pendingKey, approve, reject, withdraw };
}
