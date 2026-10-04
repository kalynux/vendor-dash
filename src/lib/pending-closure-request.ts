import { useEffect, useSyncExternalStore } from 'react';
import { getClosureRequest } from '@/services/closure-request.service';
import type { ClosureRequest } from '@/types/closure-request.types';

/**
 * The shop-closure request waiting for this vendor, if any (ADR-A10, 2026-10-04).
 *
 * Read once when the dashboard opens — that is what drives the banner — and
 * again by the closure screen itself, which also writes its answer back here
 * with `setPendingClosureRequest` so the banner disappears the moment the
 * vendor declines. Same shape as `pending-fee-proposals.ts`.
 *
 * Only a `pending` request counts: the GET reports an expired one as
 * `status: 'expired'`, which is not something to act on.
 */

let snapshot: ClosureRequest | null = null;
let inFlight: Promise<ClosureRequest | null> | null = null;
const listeners = new Set<() => void>();

function publish(next: ClosureRequest | null) {
  snapshot = next && next.status === 'pending' ? next : null;
  listeners.forEach((l) => l());
}

/** Re-read the request. Rejects on failure so the closure screen can show it; the banner ignores it. */
export function refreshPendingClosureRequest(): Promise<ClosureRequest | null> {
  if (inFlight) return inFlight;
  inFlight = getClosureRequest()
    .then((request) => {
      publish(request);
      return request;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Record an answer (or a fresh read) without another round trip. */
export function setPendingClosureRequest(request: ClosureRequest | null): void {
  publish(request);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The pending request, or `null`. Fetches once when the first consumer mounts. */
export function usePendingClosureRequest(): ClosureRequest | null {
  useEffect(() => {
    // Non-fatal for the banner: no banner is the safe default.
    refreshPendingClosureRequest().catch(() => {});
  }, []);
  return useSyncExternalStore(subscribe, () => snapshot, () => null);
}

/** Forget the request on sign-out, so the next account never sees it. */
export function resetPendingClosureRequest(): void {
  publish(null);
}
