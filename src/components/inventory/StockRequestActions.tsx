import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReasonPopover } from '@/components/common/ReasonPopover';
import type { StockRequestDto } from '@/types/stock-requests.types';
import { useTranslation } from '@/i18n';

export interface StockRequestActionsProps {
  request: StockRequestDto;
  /** `verb:id` of the action currently in flight, so exactly one button spins. */
  pendingKey: string | null;
  onApprove: (id: string, requestedQuantity: number) => void;
  onReject: (id: string, reason?: string) => void;
  onWithdraw: (id: string) => void;
  className?: string;
}

/**
 * The button cluster for one request.
 *
 * **Rendered from `availableActions` and nothing else.** The server sends its
 * authority table's verdict on every DTO — `['withdraw']` if you raised it,
 * `['approve','reject']` if the agency did, `[]` once resolved. Re-deriving that
 * from `status` + `requestedByRole` client-side is how a UI ends up offering a
 * verb the API refuses.
 */
export function StockRequestActions({
  request,
  pendingKey,
  onApprove,
  onReject,
  onWithdraw,
  className,
}: StockRequestActionsProps) {
  const { t } = useTranslation();
  const { id, availableActions } = request;

  if (availableActions.length === 0) return null;

  const approving = pendingKey === `approve:${id}`;
  const rejecting = pendingKey === `reject:${id}`;
  const withdrawing = pendingKey === `withdraw:${id}`;
  const busy = approving || rejecting || withdrawing;

  return (
    <div className={className ?? 'flex flex-wrap items-center gap-2'}>
      {availableActions.includes('approve') && (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => onApprove(id, request.requestedQuantity)}
        >
          {approving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            t('inventory.requests.actions.approve')
          )}
        </Button>
      )}

      {availableActions.includes('reject') && (
        <ReasonPopover
          triggerLabel={t('inventory.requests.actions.reject')}
          confirmLabel={t('inventory.requests.actions.confirmReject')}
          placeholder={t('inventory.requests.actions.reasonPlaceholder')}
          variant="destructive"
          disabled={rejecting}
          onConfirm={(reason) => onReject(id, reason.trim() || undefined)}
        />
      )}

      {availableActions.includes('withdraw') && (
        <ReasonPopover
          triggerLabel={t('inventory.requests.actions.withdraw')}
          confirmLabel={t('inventory.requests.actions.confirmWithdraw')}
          // Withdraw takes no reason — the popover is a confirmation step only.
          hideReason
          hint={t('inventory.requests.actions.withdrawHint')}
          variant="outline"
          disabled={withdrawing}
          onConfirm={() => onWithdraw(id)}
        />
      )}
    </div>
  );
}

export default StockRequestActions;
