import { useEffect, useRef } from 'react';

/**
 * Calls `refresh` when the person comes back to the screen — the browser tab is
 * focused again, or the phone app returns to the foreground.
 *
 * For lists that can change without a notification telling us so. Focus and
 * visibility usually fire together, so calls closer than `minIntervalMs` apart
 * are dropped.
 */
export function useRefreshOnFocus(
  refresh: () => void,
  { enabled = true, minIntervalMs = 15_000 }: { enabled?: boolean; minIntervalMs?: number } = {},
) {
  // Always the latest callback, without re-subscribing the listeners for it.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  const lastRun = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    // The screen has just loaded its own data — don't refetch on the first focus.
    lastRun.current = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRun.current < minIntervalMs) return;
      lastRun.current = now;
      refreshRef.current();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, minIntervalMs]);
}
