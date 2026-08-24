import * as React from 'react';

/**
 * Whether a pinned header's secondary row (search / filters / tab strip) should
 * currently be on screen.
 *
 * The rule people expect from a native app: **hiding is lazy, revealing is
 * eager.** You have to mean it to push the search bar away — a couple of dozen
 * pixels down the page — but the moment you flick back up it is there, because
 * the only reason to scroll up on a list is to get at the controls above it.
 * A symmetric threshold gets this wrong in the direction that costs the most:
 * it makes the vendor scroll up twice.
 *
 * ── Why this replaced a plain scroll-direction hook ──────────────────────────
 *
 * Collapsing a row inside a `sticky` header **shortens the document**, and a
 * shorter document can move the scroll position on its own — hard against the
 * bottom of a list it *must*. That synthetic movement arrives as an ordinary
 * scroll event pointing the other way, which re-opens the row, which lengthens
 * the document again. The row ends up flickering, or reveals a beat late while
 * the two fight, which reads as "the search bar doesn't come back".
 *
 * Three guards, each aimed at one leg of that loop:
 *
 *  1. **A settle window.** For `SETTLE_MS` after a flip the position is still
 *     tracked but the state is frozen, so the reflow the flip itself caused
 *     cannot flip it back. Tracking continues so no phantom delta banks up.
 *  2. **The bottom of the document is inert.** Movement that happens while the
 *     viewport is against the end of the list is the clamp, not a gesture.
 *  3. **The top always reveals.** Above `minOffset` there is nothing to gain by
 *     hiding, and it is where a reflow lands you.
 */
export interface HeaderRevealOptions {
  /** Always revealed while the page is scrolled less than this (px). */
  minOffset?: number;
  /** Sustained downward travel needed to hide (px). Deliberately the larger. */
  hideAfter?: number;
  /** Sustained upward travel needed to reveal (px). Deliberately the smaller. */
  showAfter?: number;
  /**
   * Skip the listener entirely. Pass false where there is nothing to reveal —
   * a scroll listener that re-renders a header with no collapsible row is pure
   * cost, and it is mounted on every screen in the app.
   */
  enabled?: boolean;
}

/** Matches the row's own collapse transition, so the reflow lands inside it. */
const SETTLE_MS = 320;

function scrollTop(): number {
  return Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
}

/** True when the viewport is against the end of the document (± rounding). */
function atBottom(): boolean {
  const doc = document.documentElement;
  return scrollTop() + window.innerHeight >= doc.scrollHeight - 2;
}

export function useHeaderReveal({
  minOffset = 48,
  hideAfter = 28,
  showAfter = 6,
  enabled = true,
}: HeaderRevealOptions = {}): boolean {
  const [revealed, setRevealed] = React.useState(true);

  const lastY = React.useRef(0);
  const accum = React.useRef(0);
  const frozenUntil = React.useRef(0);
  const ticking = React.useRef(false);

  React.useEffect(() => {
    if (!enabled) return;
    lastY.current = scrollTop();

    /** Freeze flips for one transition, without losing track of where we are. */
    const flip = (next: boolean) => {
      accum.current = 0;
      frozenUntil.current = performance.now() + SETTLE_MS;
      setRevealed(next);
    };

    const update = () => {
      ticking.current = false;
      const y = scrollTop();
      const delta = y - lastY.current;
      lastY.current = y;

      // Near the top there is nothing above to reach, and this is where a
      // reflow puts you — so it is unconditionally open.
      if (y <= minOffset) {
        accum.current = 0;
        setRevealed(true);
        return;
      }

      // (1) Inside the settle window the position is tracked — note `lastY` was
      // already updated above — but the state is held still.
      if (performance.now() < frozenUntil.current) {
        accum.current = 0;
        return;
      }

      // (2) At the end of the list, movement is the browser clamping the scroll
      // position after the row's own collapse, not the vendor scrolling.
      if (atBottom()) {
        accum.current = 0;
        return;
      }

      // A change of direction starts counting fresh, so momentum wobble at the
      // end of a flick cannot bank up into a flip.
      if ((delta > 0 && accum.current < 0) || (delta < 0 && accum.current > 0)) {
        accum.current = 0;
      }
      accum.current += delta;

      if (accum.current > hideAfter) flip(false);
      else if (accum.current < -showAfter) flip(true);
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(update);
    };

    // A new gesture is a fresh intent: drop whatever the last one had banked,
    // so a flick up right after a flick down reveals on its first few pixels
    // instead of first having to pay off the downward total.
    const onTouchStart = () => {
      accum.current = 0;
      lastY.current = scrollTop();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchstart', onTouchStart);
    };
  }, [enabled, minOffset, hideAfter, showAfter]);

  // Disabled means there is nothing to collapse, so the answer is "showing".
  return enabled ? revealed : true;
}
