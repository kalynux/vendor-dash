import { useEffect, useRef } from 'react';
import { getVectorisationStatus } from '@/services/products.service';
import { subscribeNetworkRestored } from '@/platform/network';
import { ApiError } from '@/types/api';
import type { ApiVectorisationStatus, VectorisationStatusDto } from '@/types/product.types';

interface IndexableRow {
  id: string;
  vectorisationEnabled: boolean;
  vectorisationStatus: ApiVectorisationStatus;
}

/**
 * Stop asking after this long. A report the vectoriser loses leaves the product
 * at `pending` until someone runs `scripts/reconcile-vectorisation.ts` by hand
 * on the server, so without a cap a stuck row would be polled forever. Past it
 * the badge keeps saying "Indexing…" and the header's refresh still works.
 */
const GIVE_UP_MS = 10 * 60 * 1000;

/** Quick checks right after indexing starts, then backing off. */
function delayFor(elapsedMs: number): number {
  if (elapsedMs < 60_000) return 5_000;
  if (elapsedMs < 3 * 60_000) return 15_000;
  return 30_000;
}

/**
 * Keeps the "Indexing…" rows of a list up to date without reloading it.
 *
 * Every row on screen with `vectorisationStatus: 'pending'` is checked one by
 * one through `GET /vendor/products/:id/vectorisation/status` — services too,
 * they are products underneath. When a check comes back no longer pending,
 * `onSettled` gets the new snapshot (and the row as it was, for its name), and
 * the caller swaps it into the row. That also unlocks Edit, which reads the
 * same field.
 *
 * Pauses while the tab or app is in the background and checks at once on the
 * way back, or when the network returns. Each row is given up on after
 * `GIVE_UP_MS`; it is watched again only once it has left `pending` and come
 * back (a retry, a re-enable).
 */
export function useIndexingWatch<T extends IndexableRow>(
  rows: T[],
  onSettled: (snapshot: VectorisationStatusDto, row: T | undefined) => void,
): void {
  const rowsRef = useRef(rows);
  const onSettledRef = useRef(onSettled);
  // Declared before the polling effect, so it sees this render's rows.
  useEffect(() => {
    rowsRef.current = rows;
    onSettledRef.current = onSettled;
  });

  /** Row id → when we started watching it. */
  const watched = useRef(new Map<string, number>());
  const givenUp = useRef(new Set<string>());

  const pendingKey = rows
    .filter((r) => r.vectorisationStatus === 'pending')
    .map((r) => r.id)
    .sort()
    .join(',');

  useEffect(() => {
    const now = Date.now();
    const pending = new Set(pendingKey ? pendingKey.split(',') : []);
    for (const r of rowsRef.current) {
      if (r.vectorisationStatus !== 'pending') givenUp.current.delete(r.id);
    }
    for (const id of watched.current.keys()) {
      if (!pending.has(id)) watched.current.delete(id);
    }
    for (const id of pending) {
      if (!watched.current.has(id) && !givenUp.current.has(id)) watched.current.set(id, now);
    }
    if (watched.current.size === 0) return;

    let cancelled = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (cancelled || watched.current.size === 0) return;
      const youngest = Math.min(
        ...Array.from(watched.current.values(), (since) => Date.now() - since),
      );
      timer = setTimeout(tick, delayFor(youngest));
    };

    async function tick() {
      clearTimeout(timer);
      if (cancelled || running) return;
      // Hidden: no new timer. The visibility listener restarts the loop.
      if (document.visibilityState !== 'visible') return;
      running = true;
      const startedAt = Date.now();
      const ids = Array.from(watched.current.keys());
      const results = await Promise.all(
        ids.map((id) =>
          getVectorisationStatus(id).then(
            (snapshot) => ({ id, snapshot }),
            (error: unknown) => ({ id, error }),
          ),
        ),
      );
      running = false;
      if (cancelled) return;

      for (const result of results) {
        if ('snapshot' in result) {
          if (result.snapshot.vectorisationStatus !== 'pending') {
            watched.current.delete(result.id);
            onSettledRef.current(
              result.snapshot,
              rowsRef.current.find((r) => r.id === result.id),
            );
            continue;
          }
        } else if (result.error instanceof ApiError && result.error.status === 404) {
          // Deleted meanwhile; the next list load drops the row.
          watched.current.delete(result.id);
          continue;
        }
        // Still pending (or the check failed). The deadline is tested after a
        // check, so coming back from a long background still gets one last look.
        const since = watched.current.get(result.id);
        if (since !== undefined && startedAt - since > GIVE_UP_MS) {
          watched.current.delete(result.id);
          givenUp.current.add(result.id);
        }
      }
      schedule();
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    const unsubscribeNetwork = subscribeNetworkRestored(onVisible);
    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribeNetwork();
    };
  }, [pendingKey]);
}
