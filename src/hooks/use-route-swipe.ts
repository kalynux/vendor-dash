import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useIsMobile } from '@/hooks/use-mobile';
import { useSwipeNavigate } from '@/hooks/use-swipe-navigate';

/**
 * Swipe sideways to move along an ordered list of routes.
 *
 * Two callers, one behaviour, because to a vendor they are one behaviour:
 *
 *  - **`DashboardShell`** passes the bottom tab bar's destinations, so a swipe
 *    walks the tab bar without reaching for it.
 *  - **The sub-tab pages** (Account, Settings, Inventory, Agency, Bookings)
 *    pass their own tabs, so a swipe walks the pill strip. On a phone those
 *    strips are the only navigation on screen, and several of them do not fit
 *    across 360px — Account has six.
 *
 * The two sets never overlap: no bottom-tab destination has sub-tabs, and no
 * sub-tab page is a bottom-tab destination. So exactly one ring is live on any
 * given screen and there is no question of which one a swipe belongs to.
 *
 * ── Two deliberate non-features ──────────────────────────────────────────────
 *
 * **It does not wrap.** Swiping past the last tab does nothing. A ring that
 * loops means a swipe at the end of Account throws you back to the start of it,
 * and with no visible strip on some of these screens there is nothing to explain
 * what happened.
 *
 * **It pushes, exactly like tapping does.** A swipe and a tap on the same tab
 * have to leave the same history behind, or back becomes unpredictable in a way
 * that depends on how the vendor happened to get there.
 *
 * Mobile only: `useIsMobile` gates it, so a trackpad's horizontal gestures on a
 * desktop browser never move the page.
 */
export function useRouteSwipe(paths: readonly string[]): void {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  // Exact pathname match: every path in these rings is a real, complete route,
  // and a prefix match would make `/dashboard` claim every screen in the app.
  const index = paths.indexOf(location.pathname);

  const go = useCallback(
    (offset: number) => {
      if (index < 0) return;
      const target = paths[index + offset];
      if (target) navigate(target);
    },
    [index, navigate, paths],
  );

  useSwipeNavigate({
    enabled: isMobile && index >= 0,
    onNext: () => go(1),
    onPrevious: () => go(-1),
  });
}
