import { useEffect, useSyncExternalStore } from 'react';
import { api } from '@/services/api';
import { subscribeNetworkRestored } from '@/platform/network';

/**
 * The Orders nav badge: how many orders are still `pending` — new, and waiting
 * for the vendor to accept or cancel them.
 *
 * There is no count endpoint, so this asks the list for one row and reads
 * `meta.total`. One shared value for every badge (tab bar, sidebar, More
 * drawer), so mounting three of them is still one request.
 *
 * Refreshed when the first badge mounts, on tab focus, on reconnect, every two
 * minutes while the page is visible, and whenever something calls
 * `refreshPendingOrdersCount()` — a status change or a new-order push.
 *
 * Talks to `api` directly rather than through `orders.service`, because the
 * service calls back into this module after a status change.
 */

const POLL_MS = 2 * 60 * 1000;

let count = 0;
let inFlight: Promise<void> | null = null;
let requestId = 0;
const listeners = new Set<() => void>();

export function refreshPendingOrdersCount(): Promise<void> {
  if (inFlight) return inFlight;
  const id = ++requestId;
  inFlight = api
    .get<{ meta: { total: number } }>('/vendor/orders?status=pending&limit=1')
    .then((res) => {
      if (id !== requestId) return;
      const next = res.meta?.total ?? 0;
      if (next === count) return;
      count = next;
      listeners.forEach((l) => l());
    })
    // Non-fatal: the badge keeps its last known value until the next refresh.
    .catch(() => {})
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Forget the count, e.g. on sign-out, so the next vendor never sees it. */
export function resetPendingOrdersCount(): void {
  requestId++;
  count = 0;
  listeners.forEach((l) => l());
}

let stopAutoRefresh: (() => void) | null = null;
let mounted = 0;

function startAutoRefresh(): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible') void refreshPendingOrdersCount();
  };
  window.addEventListener('focus', onVisible);
  document.addEventListener('visibilitychange', onVisible);
  const unsubscribeNetwork = subscribeNetworkRestored(onVisible);
  const timer = setInterval(onVisible, POLL_MS);
  void refreshPendingOrdersCount();
  return () => {
    window.removeEventListener('focus', onVisible);
    document.removeEventListener('visibilitychange', onVisible);
    unsubscribeNetwork();
    clearInterval(timer);
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePendingOrdersCount(): number {
  // Auto-refresh runs while at least one badge is on screen.
  useEffect(() => {
    if (!stopAutoRefresh) stopAutoRefresh = startAutoRefresh();
    mounted++;
    return () => {
      mounted--;
      if (mounted === 0 && stopAutoRefresh) {
        stopAutoRefresh();
        stopAutoRefresh = null;
      }
    };
  }, []);
  return useSyncExternalStore(subscribe, () => count);
}
