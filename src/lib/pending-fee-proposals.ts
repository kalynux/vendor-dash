import { useEffect, useSyncExternalStore } from 'react';
import { listDeliveryFeeProposals } from '@/services/delivery-fee-proposals.service';

/**
 * Delivery-fee proposals waiting for the vendor (2026-10-02).
 *
 * Order list rows carry no "proposal pending" flag, so the Orders page reads
 * the inbox once (`status=pending&limit=100`) and badges the rows whose
 * `orderId` appears. A pending proposal blocks pickup, which is why the count
 * is worth a banner. Refreshed on mount and after every approve/reject —
 * `refreshPendingFeeProposals()` from wherever the answer was sent.
 *
 * Since 2026-10-04 a pending proposal is not always the vendor's to answer: on
 * a customer-paid parcel the customer decides (`availableActions: []`), and a
 * change-agency difference only offers an optional `cover`. Only proposals
 * that carry `approve`/`reject` count as waiting for the vendor.
 */

interface Snapshot {
  count: number;
  /** Order ids with at least one pending proposal, newest proposal first. */
  orderIds: string[];
}

const EMPTY: Snapshot = { count: 0, orderIds: [] };

let snapshot: Snapshot = EMPTY;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function refreshPendingFeeProposals(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = listDeliveryFeeProposals({ status: 'pending', limit: 100 })
    .then(({ data, meta }) => {
      const yours = data.filter((p) => p.availableActions.includes('approve') || p.availableActions.includes('reject'));
      const orderIds = Array.from(new Set(yours.map((p) => p.orderId)));
      // Past the first 100 the total is an estimate: it drops only the ones seen to be the customer's.
      const total = meta?.total ?? data.length;
      snapshot = { count: Math.max(yours.length, total - (data.length - yours.length)), orderIds };
      listeners.forEach((l) => l());
    })
    // Non-fatal: the badges keep their last known value.
    .catch(() => {})
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The pending-proposal snapshot; fetches once when the first consumer mounts. */
export function usePendingFeeProposals(): Snapshot {
  useEffect(() => {
    void refreshPendingFeeProposals();
  }, []);
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}

/** Forget the snapshot on sign-out, so the next vendor never sees it. */
export function resetPendingFeeProposals(): void {
  snapshot = EMPTY;
  listeners.forEach((l) => l());
}
