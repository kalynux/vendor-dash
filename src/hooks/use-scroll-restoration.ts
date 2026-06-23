import * as React from 'react';

// Window scroll positions, keyed per list page, persisted for the SPA session.
const scrollPositions = new Map<string, number>();

/**
 * Saves the window scroll position for `key` (on scroll + unmount) and restores
 * it on mount. Lets a list page return to where the user left off after a tab
 * switch or a route round-trip. `enabled` lets callers scope it (e.g. only the
 * active desktop/mobile branch).
 */
export function useScrollRestoration(key: string, enabled = true): void {
  React.useLayoutEffect(() => {
    if (!enabled) return;

    const saved = scrollPositions.get(key);
    if (saved != null) {
      // Restore after layout so the page has its (cached) height.
      window.scrollTo(0, saved);
    }

    const onScroll = () => {
      scrollPositions.set(key, window.scrollY);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      scrollPositions.set(key, window.scrollY);
      window.removeEventListener('scroll', onScroll);
    };
  }, [key, enabled]);
}
