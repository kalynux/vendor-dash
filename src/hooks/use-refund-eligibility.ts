import { useCallback, useEffect, useState } from 'react';
import { fetchRefundEligibility } from '@/services/customers.service';
import { isOrderFrozen } from '@/services/orders.service';
import type { Order } from '@/types';
import type { RefundEligibility, RefundReasonCode } from '@/types/customers.types';

/**
 * Whether this order can be refunded right now, as decided by the server.
 *
 * Eligibility is not derivable on the client: it folds the vendor's return
 * policy (refunds enabled at all, full vs. a percentage, `return_window_days`
 * measured from `created_at`) together with the payment's un-refunded balance.
 * `GET /vendor/orders/:id/refund-eligibility` never throws on ineligibility —
 * it answers `200 { eligible: false, reasonCode }` — so it is safe to ask
 * before the vendor clicks anything, and the action can be hidden instead of
 * opening a dialog that could only fail.
 *
 * Two gates are applied before the request, so opening an order detail doesn't
 * cost a call that can only come back `false`:
 *   - the payment must be `paid` — the server refuses anything else with
 *     `REFUND_ORDER_NOT_PAID`, which is also what every cash-on-delivery order
 *     hits (a payment-rail limit, not a policy one);
 *   - the order must not be frozen by a dispute, the same `isOrderFrozen`
 *     check that already locks fulfilment on these screens.
 *
 * A failed probe leaves the action hidden: the vendor didn't ask for it, so it
 * reports nothing. What it cannot rule out is the gateway — only Stripe can
 * actually refund, and a mobile-money order fails with
 * `REFUND_GATEWAY_NOT_SUPPORTED` at submit time, which the dialog surfaces
 * through the error chain.
 */
export interface RefundEligibilityState {
  /** Server verdict, or null while unknown (not asked yet, or not worth asking). */
  eligibility: RefundEligibility | null;
  /** True only once the server has confirmed a refund can be issued. */
  canRefund: boolean;
  /** Why not — set only when the server answered `eligible: false`. */
  reasonCode: RefundReasonCode | undefined;
  /**
   * Re-ask. A partial refund leaves the order `paid` but moves the balance.
   * The previous verdict stays readable until the new one lands — the dialog
   * re-checks eligibility itself on open, so a stale `true` can't be acted on.
   */
  refresh: () => void;
}

export function useRefundEligibility(order: Order | null): RefundEligibilityState {
  // Tagged with the order it answers for, so a verdict is never read against a
  // different order — clearing it from the effect would re-render twice per open.
  const [answer, setAnswer] = useState<{ orderId: string; data: RefundEligibility } | null>(null);
  const [epoch, setEpoch] = useState(0);

  const orderId = order?.id ?? null;
  const worthAsking = !!order && order.paymentStatus === 'paid' && !isOrderFrozen(order);

  useEffect(() => {
    if (!orderId || !worthAsking) return;

    let cancelled = false;
    fetchRefundEligibility(orderId)
      .then((data) => {
        if (!cancelled) setAnswer({ orderId, data });
      })
      .catch(() => {
        // Passive probe — leave the action hidden rather than toast at a vendor
        // who was only looking at the order.
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, worthAsking, epoch]);

  const eligibility = worthAsking && answer?.orderId === orderId ? answer.data : null;
  const refresh = useCallback(() => setEpoch((n) => n + 1), []);

  return {
    eligibility,
    canRefund: eligibility?.eligible === true,
    reasonCode: eligibility && !eligibility.eligible ? eligibility.reasonCode : undefined,
    refresh,
  };
}
