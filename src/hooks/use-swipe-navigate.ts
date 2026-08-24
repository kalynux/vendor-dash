import * as React from 'react';

import { hasOpenOverlay } from '@/platform/shell/backButton';

/**
 * ⚠ **The edge guard is the whole reason this file is careful.**
 *
 * Android's gesture navigation and iOS's interactive pop both own an invisible
 * strip down each side of the screen: a drag that *starts* there is the system's
 * back gesture, not the app's. A swipe handler that ignores this does not merely
 * add a second meaning to the gesture — it makes going back unreliable, because
 * some drags get eaten by the app and some don't, with nothing on screen to
 * explain the difference. Losing the back gesture is far worse than never having
 * had tab swiping.
 *
 * So any gesture beginning within `EDGE_GUARD_PX` of either edge is dropped on
 * `touchstart` and never reconsidered. 28px is Android's own 24px system-gesture
 * inset plus a little slack for how imprecisely a thumb lands.
 */
const EDGE_GUARD_PX = 28;

/** Horizontal travel that counts as a swipe rather than a tap or a scroll. */
const MIN_DISTANCE_PX = 64;

/**
 * How much vertical drift a swipe may carry, as a fraction of its horizontal
 * travel. Thumbs arc — a strict axis test rejects most real swipes — but past
 * this the gesture was a diagonal scroll and the list should keep it.
 */
const MAX_OFF_AXIS_RATIO = 0.6;

/** Past this the finger was resting, not swiping. */
const MAX_DURATION_MS = 700;

export interface SwipeNavigateOptions {
  /** Finger moves right→left. "Forward", the way pages advance. */
  onNext?: () => void;
  /** Finger moves left→right. "Back", in the tab sense — not history. */
  onPrevious?: () => void;
  /** Defaults to true. Pass the viewport check here rather than branching. */
  enabled?: boolean;
}

/**
 * Whether the gesture started somewhere that already means something by moving
 * sideways — a scrolling tab strip, a carousel, a wide table.
 *
 * Without this, dragging Inventory's sub-tab strip sideways would scroll the
 * strip *and* change the page. The check walks the ancestors from wherever the
 * finger went down, because the scroller is usually several levels above the
 * element actually touched.
 */
function startedInsideHorizontalScroller(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body) {
    // An explicit opt-out for anything that handles its own drags.
    if (node.hasAttribute('data-no-swipe')) return true;
    if (node.scrollWidth - node.clientWidth > 1) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Horizontal swipe navigation, listening on the window.
 *
 * Deliberately **never calls `preventDefault`** and registers passively: the
 * same drag is a candidate scroll until it is over, and cancelling it to claim a
 * swipe would make vertical scrolling stutter on every page this is mounted on.
 * The decision is made at `touchend`, when both axes are known — which is also
 * why there is no rubber-banding follow-the-finger animation here. That would
 * need the gesture claimed up front, and it is not worth the scroll.
 */
export function useSwipeNavigate({ onNext, onPrevious, enabled = true }: SwipeNavigateOptions): void {
  const handlers = React.useRef({ onNext, onPrevious });
  React.useEffect(() => {
    handlers.current = { onNext, onPrevious };
  });

  React.useEffect(() => {
    if (!enabled) return;

    /** Null whenever the in-progress gesture has already been disqualified. */
    let start: { x: number; y: number; at: number } | null = null;

    const onTouchStart = (event: TouchEvent) => {
      start = null;
      // A second finger means a pinch or a two-finger scroll; neither is this.
      if (event.touches.length !== 1) return;

      const touch = event.touches[0];
      const width = window.innerWidth;
      if (touch.clientX <= EDGE_GUARD_PX || touch.clientX >= width - EDGE_GUARD_PX) return;
      if (startedInsideHorizontalScroller(event.target)) return;
      // A sheet or dialog owns the screen; the page behind it is not navigable.
      if (hasOpenOverlay()) return;

      start = { x: touch.clientX, y: touch.clientY, at: event.timeStamp };
    };

    const onTouchEnd = (event: TouchEvent) => {
      const from = start;
      start = null;
      if (!from) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;

      if (event.timeStamp - from.at > MAX_DURATION_MS) return;
      if (Math.abs(dx) < MIN_DISTANCE_PX) return;
      if (Math.abs(dy) > Math.abs(dx) * MAX_OFF_AXIS_RATIO) return;
      // Re-checked at the end as well as the start: a sheet can open mid-drag
      // (a long-press menu), and finishing the swipe would navigate the page
      // out from under it.
      if (hasOpenOverlay()) return;

      if (dx < 0) handlers.current.onNext?.();
      else handlers.current.onPrevious?.();
    };

    const onTouchCancel = () => {
      start = null;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [enabled]);
}
